import { describe, expect, it } from "vitest";
import { accentFor } from "./unit-accent";

describe("unit accent", () => {
  it("keeps one call sign on the same accent", () => {
    expect(accentFor("A-01")).toEqual(accentFor("A-01"));
  });

  it("returns class groups that can be shared between cards and messages", () => {
    const accent = accentFor("B-12");
    expect(accent.spine).toMatch(/^bg-/);
    expect(accent.chip).toMatch(/^bg-/);
    expect(accent.border).toMatch(/^border-l-/);
    expect(accent.soft).toContain("text-");
  });
});
