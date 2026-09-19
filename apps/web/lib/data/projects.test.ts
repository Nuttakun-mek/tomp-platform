import { describe, expect, it } from "vitest";
import { getProjectByCode } from "./projects";

describe("getProjectByCode", () => {
  it("returns null for a code that matches nothing", async () => {
    const project = await getProjectByCode("NO-SUCH-CODE-EXISTS-0000");
    expect(project).toBeNull();
  });
});
