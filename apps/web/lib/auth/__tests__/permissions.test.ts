import { describe, expect, it } from "vitest";
import { roleHasPermission } from "../permissions";

describe("RBAC permissions", () => {
  it("allows project managers to publish and apply changes", () => {
    expect(roleHasPermission("project_manager", "project.publish")).toBe(true);
    expect(roleHasPermission("project_manager", "change.apply")).toBe(true);
  });

  it("does not allow drivers to manage projects", () => {
    expect(roleHasPermission("driver", "project.publish")).toBe(false);
  });
});
