import { describe, expect, it } from "vitest";
import { resolveActiveScope } from "./scope";

const projects = [
  { id: "a", projectCode: "A", projectName: "Alpha" },
  { id: "b", projectCode: "B", projectName: "Bravo" }
];

describe("resolveActiveScope", () => {
  it("returns null when there are no projects", () => {
    expect(resolveActiveScope([], "a")).toBeNull();
  });
  it("returns the cookie project when it is still visible", () => {
    expect(resolveActiveScope(projects, "b")?.id).toBe("b");
  });
  it("falls back to the first project when the cookie project is gone", () => {
    expect(resolveActiveScope(projects, "zzz")?.id).toBe("a");
  });
  it("falls back to the first project when there is no cookie", () => {
    expect(resolveActiveScope(projects, null)?.id).toBe("a");
  });
});
