import { beforeEach, describe, expect, it, vi } from "vitest";

const PROFILE_ID = "profile-1";

let globalRoleKeys: string[] = [];
let projectMemberships: Array<{ projectId: string; roleKey: string }> = [];

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUserProfile: vi.fn(async () => ({ id: PROFILE_ID, isDevelopmentFallback: false })),
  getProjectMembership: vi.fn(async () => null)
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerDataClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "user_role_assignments") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: async () => ({ data: globalRoleKeys.map((role_key) => ({ roles: { role_key } })) })
              })
            })
          })
        };
      }
      if (table === "project_members") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: projectMemberships.map((m) => ({ project_id: m.projectId, roles: { role_key: m.roleKey } }))
              })
            })
          })
        };
      }
      throw new Error(`unexpected table ${table}`);
    }
  }))
}));

import { requirePermission, canCreateProject } from "./rbac";

describe("global permission checks do not leak from project-scoped roles", () => {
  beforeEach(() => {
    globalRoleKeys = [];
    projectMemberships = [];
  });

  it("denies project.create for a profile whose only project_manager grant is project-scoped", async () => {
    projectMemberships = [{ projectId: "project-a", roleKey: "project_manager" }];

    const result = await requirePermission("project.create");
    expect(result.allowed).toBe(false);
  });

  it("denies canCreateProject() the same way", async () => {
    projectMemberships = [{ projectId: "project-a", roleKey: "project_manager" }];

    expect(await canCreateProject()).toBe(false);
  });

  it("allows project.create for a profile with a genuine GLOBAL project_manager assignment", async () => {
    globalRoleKeys = ["project_manager"];

    const result = await requirePermission("project.create");
    expect(result.allowed).toBe(true);
    expect(await canCreateProject()).toBe(true);
  });

  it("allows project.create for super_admin regardless of project memberships", async () => {
    globalRoleKeys = ["super_admin"];
    projectMemberships = [{ projectId: "project-a", roleKey: "customer_viewer" }];

    const result = await requirePermission("project.create");
    expect(result.allowed).toBe(true);
  });
});

describe("platform-role bypass on a project-scoped permission (project-membership check)", () => {
  beforeEach(() => {
    globalRoleKeys = [];
    projectMemberships = [];
  });

  // A globally-assigned project_manager (e.g. one granted through
  // /superadmin/users so they can create their own first project) must NOT
  // get free access to every project on the platform — the bypass at the
  // bottom of requirePermission is reserved for genuinely platform-wide
  // roles (matrix is ["*"]), not "any global role that happens to include
  // this specific permission key". project_manager's matrix has no "*", so
  // it must fall through to the membership check and be denied here since
  // there is no project_members row for this project.
  it("denies project.update for a profile with only a global project_manager role and no membership in this project", async () => {
    globalRoleKeys = ["project_manager"];

    const result = await requirePermission("some-project-id", "project.update");
    expect(result.allowed).toBe(false);
  });

  it("denies project.delete for a profile with only a global project_manager role and no membership in this project", async () => {
    globalRoleKeys = ["project_manager"];

    const result = await requirePermission("some-project-id", "project.delete");
    expect(result.allowed).toBe(false);
  });

  // The bypass must still work for the one role it's meant for: super_admin's
  // matrix is ["*"], so it acts on every project without a project_members row.
  it("allows project.update for super_admin with no membership in this project", async () => {
    globalRoleKeys = ["super_admin"];

    const result = await requirePermission("some-project-id", "project.update");
    expect(result.allowed).toBe(true);
  });
});

describe("project-scoped permission checked with no project (central resource library)", () => {
  beforeEach(() => {
    globalRoleKeys = [];
    projectMemberships = [];
  });

  // driver.create/vehicle.create are NOT in GLOBAL_PERMISSIONS, so a bare
  // requirePermission("driver.create") call (no projectId — the central
  // library, which belongs to no project on purpose) must keep its
  // pre-existing flattened-role behavior, not the tightened
  // getGlobalRoleKeys-only check that GLOBAL_PERMISSIONS keys now get.
  it("allows driver.create with no project for a profile whose only dispatcher grant is project-scoped", async () => {
    projectMemberships = [{ projectId: "project-a", roleKey: "dispatcher" }];

    const result = await requirePermission("driver.create");
    expect(result.allowed).toBe(true);
  });
});
