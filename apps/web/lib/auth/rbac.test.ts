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
