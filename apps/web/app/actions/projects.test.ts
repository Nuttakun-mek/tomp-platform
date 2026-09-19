import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression coverage for the Task 14 review finding: createProjectAction's
// own fallback — `parsed.data.systemKeys?.length ? parsed.data.systemKeys :
// ["ground_transfer"]` — only kicks in when the submitted array is EMPTY. A
// non-empty array that simply omits "ground_transfer" (exactly what the
// create-project form produces if someone unchecks Ground Transfer and
// checks only Airport Transfer) sails straight through to the RPC call
// unchanged. That is intentional, not a bug in this file: the invariant
// "every project keeps a ground_transfer project_systems row and its
// creator's project_manager grant, no exceptions" is enforced at the SQL
// layer in database/migrations/0047_create_project_command_systems.sql
// (create_project_command unions 'ground_transfer' into the iterated set
// unconditionally, deduped via array_agg distinct), not here — because the
// RPC is also reachable from callers other than this action (an admin tool,
// a future direct call) that this file's fallback can't protect.
//
// This test locks in the app-layer half of that contract: the action must
// pass the caller's selection through to `p_system_keys` unchanged (other
// than the empty/omitted-array fallback), so a future edit doesn't
// accidentally introduce a second, redundant, and possibly inconsistent
// "fix" here that masks a real regression in the SQL-layer enforcement.

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const PROFILE_ID = "00000000-0000-4000-8000-000000000002";

// vi.mock(...) factories below run before this file's own top-level code (the
// imported "./projects" module graph, including the mocked
// "@/lib/supabase/server-write", is evaluated ahead of this file's own
// statements) — a plain `const rpcMock = vi.fn()` referenced inside a
// factory would still be in its temporal dead zone when the factory runs.
// vi.hoisted() is Vitest's documented way to define a mock-referenced
// variable that is guaranteed to be initialized before any vi.mock() factory
// runs.
const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(async () => ({
    data: { id: "00000000-0000-4000-8000-000000000099", project_code: "TOMP-TEST" },
    error: null
  }))
}));

vi.mock("@/lib/auth/rbac", () => ({
  requirePermission: vi.fn(async () => ({ allowed: true }))
}));

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUserProfile: vi.fn(async () => ({
    id: PROFILE_ID,
    authUserId: "auth-user-1",
    organizationId: ORG_ID,
    isDevelopmentFallback: false
  }))
}));

vi.mock("@/lib/data/mappers", () => ({
  mapProject: vi.fn((row: unknown) => row),
  mapTimelineEvent: vi.fn((row: unknown) => row)
}));

vi.mock("@/lib/supabase/server-write", () => ({
  getSupabaseWriteClient: vi.fn(() => ({
    mode: "test",
    client: {
      rpc: rpcMock,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: { id: ORG_ID } }))
          }))
        }))
      }))
    }
  }))
}));

import { createProjectAction } from "./projects";

const baseInput = {
  organizationId: ORG_ID,
  projectName: "Test project",
  startDate: "2026-01-01",
  endDate: "2026-01-02",
  timezone: "Asia/Bangkok",
  visibilityLevel: "internal",
  serviceLevel: "standard",
  metadata: {}
};

describe("createProjectAction p_system_keys contract", () => {
  beforeEach(() => {
    rpcMock.mockClear();
  });

  it("passes systemKeys straight through to the RPC even when 'ground_transfer' is omitted", async () => {
    const result = await createProjectAction({
      ...baseInput,
      projectCode: "TOMP-TEST-A",
      systemKeys: ["airport_transfer"]
    });

    expect(result.success).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith(
      "create_project_command",
      expect.objectContaining({ p_system_keys: ["airport_transfer"] })
    );
  });

  it("falls back to ['ground_transfer'] only when systemKeys is empty or omitted", async () => {
    const result = await createProjectAction({
      ...baseInput,
      projectCode: "TOMP-TEST-B"
      // systemKeys omitted entirely
    });

    expect(result.success).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith(
      "create_project_command",
      expect.objectContaining({ p_system_keys: ["ground_transfer"] })
    );
  });

  it("passes both keys through when the creator selects Ground Transfer and Airport Transfer together", async () => {
    const result = await createProjectAction({
      ...baseInput,
      projectCode: "TOMP-TEST-C",
      systemKeys: ["ground_transfer", "airport_transfer"]
    });

    expect(result.success).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith(
      "create_project_command",
      expect.objectContaining({ p_system_keys: ["ground_transfer", "airport_transfer"] })
    );
  });
});
