import { describe, expect, it } from "vitest";
import { resolvePrimaryRole, resolveRedirectPath } from "./role-model";

describe("resolvePrimaryRole", () => {
  it("picks the highest-ranked role", () => {
    expect(resolvePrimaryRole(["dispatcher", "project_manager"])).toBe("project_manager");
    expect(resolvePrimaryRole(["coordinator", "dispatcher"])).toBe("dispatcher");
  });
  it("returns null for empty, unknown, or dropped legacy roles", () => {
    expect(resolvePrimaryRole([])).toBeNull();
    expect(resolvePrimaryRole(["made_up"])).toBeNull();
    expect(resolvePrimaryRole(["organization_admin", "planner"])).toBeNull();
  });
  it("keeps super_admin on top", () => {
    expect(resolvePrimaryRole(["customer_viewer", "super_admin", "dispatcher"])).toBe("super_admin");
  });
});

describe("resolveRedirectPath", () => {
  it("maps roles to their landing route", () => {
    expect(resolveRedirectPath("super_admin")).toBe("/");
    expect(resolveRedirectPath("project_manager")).toBe("/projects");
    expect(resolveRedirectPath("dispatcher")).toBe("/projects");
    expect(resolveRedirectPath("coordinator")).toBe("/projects");
    expect(resolveRedirectPath("customer_viewer")).toBe("/portal");
  });
  it("sends unknown/null/driver to /no-access", () => {
    expect(resolveRedirectPath(null)).toBe("/no-access");
    expect(resolveRedirectPath("mystery")).toBe("/no-access");
    expect(resolveRedirectPath("driver")).toBe("/no-access");
  });
});
