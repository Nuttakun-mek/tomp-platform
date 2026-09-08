import { describe, expect, it } from "vitest";
import { permissionsForRoles, roleHasPermission } from "../permissions";

describe("RBAC permissions", () => {
  it("allows project managers to publish and apply changes", () => {
    expect(roleHasPermission("project_manager", "project.publish")).toBe(true);
    expect(roleHasPermission("project_manager", "change.apply")).toBe(true);
  });

  it("does not allow drivers to manage projects", () => {
    expect(roleHasPermission("driver", "project.publish")).toBe(false);
  });
});

describe("permissionsForRoles", () => {
  it("unions permissions across roles and dedupes", () => {
    const result = permissionsForRoles(["planner", "coordinator"]);
    expect(result).toContain("mission.create");
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

describe("roleHasPermission edge cases", () => {
  it("wildcard grants any permission", () => {
    expect(roleHasPermission("super_admin", "anything.at.all")).toBe(true);
  });
  it("unknown role denies", () => {
    expect(roleHasPermission("ghost", "project.read")).toBe(false);
  });
});
