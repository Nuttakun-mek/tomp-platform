import { describe, expect, it } from "vitest";
import { buildRoleMatrix } from "./overview";

describe("buildRoleMatrix", () => {
  it("produces sorted role + permission axes and a lookup grid", () => {
    const matrix = buildRoleMatrix([
      { role_key: "dispatcher", permission_key: "assignment.read" },
      { role_key: "dispatcher", permission_key: "assignment.create" },
      { role_key: "planner", permission_key: "assignment.read" }
    ]);

    expect(matrix.roles).toEqual(["dispatcher", "planner"]);
    expect(matrix.permissions).toEqual(["assignment.create", "assignment.read"]);
    expect(matrix.grid.dispatcher.has("assignment.create")).toBe(true);
    expect(matrix.grid.planner.has("assignment.create")).toBe(false);
    expect(matrix.grid.planner.has("assignment.read")).toBe(true);
  });

  it("ignores malformed rows", () => {
    const matrix = buildRoleMatrix([
      { role_key: "", permission_key: "x" },
      { role_key: "y", permission_key: "" }
    ] as unknown as Array<{ role_key: string; permission_key: string }>);
    expect(matrix.roles).toEqual([]);
    expect(matrix.permissions).toEqual([]);
  });
});
