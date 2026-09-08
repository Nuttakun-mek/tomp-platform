import { describe, expect, it } from "vitest";
import { resolvePrimaryRole, resolveRedirectPath } from "./role-model";

describe("resolvePrimaryRole", () => {
  it("picks the highest-ranked role", () => {
    expect(resolvePrimaryRole(["dispatcher", "operation_manager"])).toBe("operation_manager");
    expect(resolvePrimaryRole(["coordinator", "planner"])).toBe("planner");
  });
  it("returns null for empty or unknown roles", () => {
    expect(resolvePrimaryRole([])).toBeNull();
    expect(resolvePrimaryRole(["made_up"])).toBeNull();
  });
  it("keeps super_admin on top", () => {
    expect(resolvePrimaryRole(["organizer", "super_admin", "dispatcher"])).toBe("super_admin");
  });
});

describe("resolveRedirectPath", () => {
  it("maps roles to their landing route", () => {
    expect(resolveRedirectPath("dispatcher")).toBe("/assignments");
    expect(resolveRedirectPath("operation_manager")).toBe("/mission-control");
    expect(resolveRedirectPath("planner")).toBe("/projects");
    expect(resolveRedirectPath("organizer")).toBe("/portal");
    expect(resolveRedirectPath("super_admin")).toBe("/");
  });
  it("sends unknown/null to /no-access", () => {
    expect(resolveRedirectPath(null)).toBe("/no-access");
    expect(resolveRedirectPath("mystery")).toBe("/no-access");
  });
});
