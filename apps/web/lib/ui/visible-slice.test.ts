import { describe, expect, it } from "vitest";
import { sliceView } from "./visible-slice";

const items = Array.from({ length: 25 }, (_, i) => i);

describe("sliceView", () => {
  it("caps the list at the limit and reports the remainder", () => {
    const view = sliceView(items, 10, 10);
    expect(view.visible).toHaveLength(10);
    expect(view.hidden).toBe(15);
    expect(view.hasMore).toBe(true);
    expect(view.expanded).toBe(false);
  });

  it("never shows fewer than the initial count", () => {
    expect(sliceView(items, 3, 10).visible).toHaveLength(10);
  });

  it("marks expanded once everything fits and the list was actually capped", () => {
    expect(sliceView(items, 25, 10).expanded).toBe(true);
    expect(sliceView(items.slice(0, 8), 10, 10).expanded).toBe(false);
  });

  it("has nothing hidden when the list is short", () => {
    const view = sliceView(items.slice(0, 5), 10, 10);
    expect(view.hasMore).toBe(false);
    expect(view.hidden).toBe(0);
  });
});
