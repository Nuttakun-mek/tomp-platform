import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression test for the final whole-branch review's Finding 2: migration
// 0047's create_project_command() unions 'ground_transfer' into every new
// project unconditionally ("must not be able to opt a project out of" it —
// see that migration's own comment), but toggleProjectSystemAction had no
// matching guard: it would happily delete the ground_transfer project_systems
// row on request, re-opening the orphaned-project bug 0047 was written to
// close. This locks in the app-layer half of that invariant: disabling
// ground_transfer must be refused before any database call is made, while
// airport_transfer stays freely toggleable either way.

const PROJECT_ID = "10000000-0000-4000-8000-000000000003";

const { upsertMock, deleteEqMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(async () => ({ error: null })),
  deleteEqMock: vi.fn(async () => ({ error: null }))
}));

vi.mock("@/lib/auth/rbac", () => ({
  requirePermission: vi.fn(async () => ({ allowed: true }))
}));

vi.mock("@/lib/airport-transfer/access", () => ({
  getAirportTransferAccess: vi.fn(async () => ({ allowed: false, canManage: false, role: null, profileId: "p", signedIn: true }))
}));

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUserProfile: vi.fn(async () => ({
    id: "profile-1",
    authUserId: "auth-user-1",
    organizationId: "org-1",
    isDevelopmentFallback: false
  }))
}));

vi.mock("@/lib/supabase/server-write", () => ({
  getSupabaseWriteClient: vi.fn(() => ({
    mode: "test",
    client: {
      from: vi.fn(() => ({
        upsert: upsertMock,
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: deleteEqMock
          }))
        }))
      }))
    }
  }))
}));

import { toggleProjectSystemAction } from "./project-systems";

describe("toggleProjectSystemAction ground_transfer guard", () => {
  beforeEach(() => {
    upsertMock.mockClear();
    deleteEqMock.mockClear();
  });

  it("rejects disabling ground_transfer without touching the database", async () => {
    const result = await toggleProjectSystemAction({ projectId: PROJECT_ID, systemKey: "ground_transfer", enabled: false });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Ground Transfer");
    expect(upsertMock).not.toHaveBeenCalled();
    expect(deleteEqMock).not.toHaveBeenCalled();
  });

  it("rejects disabling ground_transfer when enabled field is omitted", async () => {
    const result = await toggleProjectSystemAction({ projectId: PROJECT_ID, systemKey: "ground_transfer" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Ground Transfer");
    expect(upsertMock).not.toHaveBeenCalled();
    expect(deleteEqMock).not.toHaveBeenCalled();
  });

  it("allows enabling ground_transfer (idempotent re-enable, not a disable)", async () => {
    const result = await toggleProjectSystemAction({ projectId: PROJECT_ID, systemKey: "ground_transfer", enabled: true });

    expect(result.success).toBe(true);
    expect(upsertMock).toHaveBeenCalled();
  });

  it("allows disabling airport_transfer", async () => {
    const result = await toggleProjectSystemAction({ projectId: PROJECT_ID, systemKey: "airport_transfer", enabled: false });

    expect(result.success).toBe(true);
    expect(deleteEqMock).toHaveBeenCalled();
  });

  it("allows enabling airport_transfer", async () => {
    const result = await toggleProjectSystemAction({ projectId: PROJECT_ID, systemKey: "airport_transfer", enabled: true });

    expect(result.success).toBe(true);
    expect(upsertMock).toHaveBeenCalled();
  });
});
