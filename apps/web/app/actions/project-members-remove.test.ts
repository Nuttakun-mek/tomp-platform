import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake Supabase write client that records every update: table, patch and the
// filters it was scoped by. Selects answer from `activeRowsLeft`.
type Update = { table: string; patch: Record<string, unknown>; filters: Record<string, unknown> };
const updates: Update[] = [];
let activeRowsLeft: unknown[] = [];

function builder(table: string) {
  const filters: Record<string, unknown> = {};
  let patch: Record<string, unknown> | null = null;
  const chain = {
    update(next: Record<string, unknown>) {
      patch = next;
      return chain;
    },
    select() {
      return chain;
    },
    eq(column: string, value: unknown) {
      filters[column] = value;
      return chain;
    },
    limit() {
      return Promise.resolve({ data: activeRowsLeft, error: null });
    },
    then(resolve: (value: { error: null }) => void) {
      if (patch) updates.push({ table, patch, filters: { ...filters } });
      resolve({ error: null });
    }
  };
  return chain;
}

const permission = vi.fn(async () => ({ allowed: true }));
vi.mock("@/lib/auth/rbac", () => ({ requirePermission: () => permission() }));
vi.mock("@/lib/airport-transfer/access", () => ({ getAirportTransferAccess: vi.fn(async () => ({ canManage: false })) }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserProfile: vi.fn(async () => ({ id: VIEWER })) }));
vi.mock("@/lib/supabase/server-write", () => ({ getSupabaseWriteClient: () => ({ client: { from: builder }, error: null }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const PROJECT = "10000000-0000-4000-8000-000000000003";
const VIEWER = "20000000-0000-4000-8000-000000000001";
const MEMBER = "20000000-0000-4000-8000-000000000002";

import { removeProjectMemberAction } from "./project-members";

describe("removeProjectMemberAction", () => {
  beforeEach(() => {
    updates.length = 0;
    activeRowsLeft = [];
    permission.mockResolvedValue({ allowed: true });
  });

  it("marks the membership removed, scoped to that project, person and system", async () => {
    const result = await removeProjectMemberAction({ projectId: PROJECT, profileId: MEMBER, systemKey: "ground_transfer" });
    expect(result.success).toBe(true);
    expect(updates[0]).toEqual({
      table: "project_members",
      patch: { status: "removed" },
      filters: { project_id: PROJECT, profile_id: MEMBER, system_key: "ground_transfer" }
    });
  });

  it("revokes the person's helper links when no active role in the project is left", async () => {
    await removeProjectMemberAction({ projectId: PROJECT, profileId: MEMBER, systemKey: "ground_transfer" });
    expect(updates.find((u) => u.table === "project_helper_tokens")).toEqual({
      table: "project_helper_tokens",
      patch: { status: "revoked" },
      filters: { project_id: PROJECT, profile_id: MEMBER, status: "active" }
    });
  });

  it("keeps helper links while the person still holds another role in the project", async () => {
    activeRowsLeft = [{ id: "other-system-row" }];
    await removeProjectMemberAction({ projectId: PROJECT, profileId: MEMBER, systemKey: "ground_transfer" });
    expect(updates.some((u) => u.table === "project_helper_tokens")).toBe(false);
  });

  it("refuses to let a manager remove themselves", async () => {
    const result = await removeProjectMemberAction({ projectId: PROJECT, profileId: VIEWER, systemKey: "ground_transfer" });
    expect(result.success).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it("refuses without permission to manage members", async () => {
    permission.mockResolvedValue({ allowed: false, reason: "no" } as never);
    const result = await removeProjectMemberAction({ projectId: PROJECT, profileId: MEMBER, systemKey: "ground_transfer" });
    expect(result.success).toBe(false);
    expect(updates).toHaveLength(0);
  });
});
