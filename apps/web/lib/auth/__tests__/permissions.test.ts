import { describe, expect, it } from "vitest";
import { isGlobalPermission, permissionsForRoles, roleHasPermission } from "../permissions";

describe("RBAC permissions", () => {
  it("allows project managers to publish and create missions", () => {
    expect(roleHasPermission("project_manager", "project.publish")).toBe(true);
    expect(roleHasPermission("project_manager", "mission.create")).toBe(true);
  });

  it("does not allow drivers or coordinators to publish", () => {
    expect(roleHasPermission("driver", "project.publish")).toBe(false);
    expect(roleHasPermission("coordinator", "project.publish")).toBe(false);
  });

  it("collapses legacy roles to no permissions", () => {
    expect(roleHasPermission("organization_admin", "project.read")).toBe(false);
    expect(roleHasPermission("planner", "mission.create")).toBe(false);
  });
});

describe("permissionsForRoles", () => {
  it("unions permissions across roles and dedupes", () => {
    const result = permissionsForRoles(["dispatcher", "coordinator"]);
    expect(result).toContain("assignment.create");
    expect(result).toContain("timeline.read");
    expect(new Set(result).size).toBe(result.length);
  });
  it("super_admin yields the wildcard", () => {
    expect(permissionsForRoles(["super_admin"])).toEqual(["*"]);
  });
  it("unknown role contributes nothing", () => {
    expect(permissionsForRoles(["nope"])).toEqual([]);
  });
});

describe("isGlobalPermission", () => {
  it("treats project.create and admin.manage_users as global (not project-scoped)", () => {
    expect(isGlobalPermission("project.create")).toBe(true);
    expect(isGlobalPermission("admin.manage_users")).toBe(true);
    expect(isGlobalPermission("superadmin.access")).toBe(true);
  });
  it("treats operational permissions as project-scoped", () => {
    expect(isGlobalPermission("mission.create")).toBe(false);
    expect(isGlobalPermission("assignment.read")).toBe(false);
    expect(isGlobalPermission("project.publish")).toBe(false);
  });
});

describe("roleHasPermission edge cases", () => {
  it("wildcard grants any permission", () => {
    expect(roleHasPermission("super_admin", "anything.at.all")).toBe(true);
  });
  it("unknown role denies", () => {
    expect(roleHasPermission("ghost", "project.read")).toBe(false);
  });
});
