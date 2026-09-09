import { describe, expect, it } from "vitest";
import { combineResults, dataFail, dataOk, runListQuery } from "./data-result";

describe("runListQuery", () => {
  it("maps rows on success", async () => {
    const result = await runListQuery<number[]>({
      fallback: [],
      label: "widgets",
      query: async () => ({ data: [{ n: 1 }, { n: 2 }], error: null }),
      map: (rows) => rows.map((row) => Number(row.n))
    });
    expect(result).toEqual({ ok: true, data: [1, 2] });
  });

  it("returns ok with the empty fallback when the payload is not an array", async () => {
    const result = await runListQuery<number[]>({
      fallback: [],
      label: "widgets",
      query: async () => ({ data: null, error: null }),
      map: () => [1]
    });
    expect(result).toEqual({ ok: true, data: [] });
  });

  it("returns ok:false with the fallback on a PostgREST error", async () => {
    const result = await runListQuery<number[]>({
      fallback: [],
      label: "widgets",
      query: async () => ({ data: null, error: { message: "permission denied" } }),
      map: () => [1]
    });
    expect(result.ok).toBe(false);
    expect(result.data).toEqual([]);
    expect(result.ok === false && result.error).toContain("permission denied");
  });

  it("returns ok:false when the query throws (transport/timeout)", async () => {
    const result = await runListQuery<number[]>({
      fallback: [],
      label: "widgets",
      timeoutMs: 20,
      query: () => new Promise(() => {}),
      map: () => [1]
    });
    expect(result.ok).toBe(false);
  });
});

describe("combineResults", () => {
  it("is ok only when every part is ok", () => {
    expect(combineResults(dataOk(1), dataOk(2))).toEqual({ ok: true });
    const combined = combineResults(dataOk(1), dataFail(0, "boom"));
    expect(combined.ok).toBe(false);
    expect(combined.error).toBe("boom");
  });
});
