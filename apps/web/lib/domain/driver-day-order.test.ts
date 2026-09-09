import { describe, expect, it } from "vitest";
import { isUrgentMeta, orderDriverJobs, type DriverJobInput } from "./driver-day-order";

const job = (over: Partial<DriverJobInput>): DriverJobInput => ({
  id: over.id ?? "x",
  status: over.status ?? "planned",
  startTime: over.startTime ?? null,
  createdAt: over.createdAt ?? null,
  sequence: over.sequence ?? null,
  urgent: over.urgent ?? false,
  isCurrent: over.isCurrent ?? false
});

describe("orderDriverJobs", () => {
  it("puts the current job first, urgent next, then by start time, done last", () => {
    const result = orderDriverJobs([
      job({ id: "done", status: "completed" }),
      job({ id: "later", startTime: "2026-09-09T10:00:00Z" }),
      job({ id: "current", isCurrent: true }),
      job({ id: "urgent", urgent: true }),
      job({ id: "soon", startTime: "2026-09-09T08:00:00Z" })
    ]);
    expect(result.map((r) => r.id)).toEqual(["current", "urgent", "soon", "later", "done"]);
    expect(result.map((r) => r.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it("marks the first non-current, not-done job as next", () => {
    const result = orderDriverJobs([
      job({ id: "current", isCurrent: true }),
      job({ id: "a", startTime: "2026-09-09T08:00:00Z" }),
      job({ id: "b", startTime: "2026-09-09T09:00:00Z" })
    ]);
    expect(result.find((r) => r.isNext)?.id).toBe("a");
  });

  it("honours an explicit sequence within a tier", () => {
    const result = orderDriverJobs([
      job({ id: "a", sequence: 2, startTime: "2026-09-09T08:00:00Z" }),
      job({ id: "b", sequence: 1, startTime: "2026-09-09T09:00:00Z" })
    ]);
    expect(result.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("has no next job when everything is done", () => {
    const result = orderDriverJobs([job({ id: "a", status: "completed" }), job({ id: "b", status: "cancelled" })]);
    expect(result.some((r) => r.isNext)).toBe(false);
  });
});

describe("isUrgentMeta", () => {
  it("reads the urgent flag and priority levels", () => {
    expect(isUrgentMeta({ urgent: true })).toBe(true);
    expect(isUrgentMeta({ priority: "urgent" })).toBe(true);
    expect(isUrgentMeta({ priority: "high" })).toBe(true);
    expect(isUrgentMeta({ priority: "normal" })).toBe(false);
    expect(isUrgentMeta(null)).toBe(false);
  });
});
