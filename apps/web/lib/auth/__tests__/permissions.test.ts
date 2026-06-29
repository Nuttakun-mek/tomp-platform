import { describe, expect, it } from "vitest";
import { hasPermission } from "../permissions";

describe("RBAC permissions", () => {
  it("allows project managers to publish and apply changes", () => {
    expect(hasPermission("project_manager", "project.publish")).toBe(true);
    expect(hasPermission("project_manager", "change.apply")).toBe(true);
  });

  it("does not allow drivers to manage projects", () => {
    expect(hasPermission("driver", "project.publish")).toBe(false);
  });
});
