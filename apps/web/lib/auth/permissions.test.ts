import { describe, expect, it } from "vitest";
import { roleHasPermission } from "./permissions";

describe("project.manage_members", () => {
  it("is granted to project_manager", () => {
    expect(roleHasPermission("project_manager", "project.manage_members")).toBe(true);
  });

  it("is not granted to dispatcher", () => {
    expect(roleHasPermission("dispatcher", "project.manage_members")).toBe(false);
  });
});
