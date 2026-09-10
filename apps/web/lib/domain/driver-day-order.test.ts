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

describe("a driver's card in the control room", () => {
  // The fleet board sorts the jobs inside one driver's card through this, so the
  // rules that matter to a dispatcher are pinned here: the job being worked
  // stays on top, and work added during the day falls in behind it rather than
  // jumping the queue.
  const job = (over: Partial<DriverJobInput> & { id: string }): DriverJobInput => ({
    status: "published",
    startTime: null,
    createdAt: "2026-09-10T06:00:00Z",
    sequence: null,
    urgent: false,
    isCurrent: false,
    ...over
  });

  it("keeps the job in progress first when newer work arrives", () => {
    const ordered = orderDriverJobs([
      job({ id: "new", createdAt: "2026-09-10T11:00:00Z", startTime: "2026-09-10T12:00:00Z" }),
      job({ id: "running", isCurrent: true, status: "active", startTime: "2026-09-10T09:00:00Z" })
    ]);
    expect(ordered.map((j) => j.id)).toEqual(["running", "new"]);
  });

  it("queues the remaining work behind the current job in the order it is due", () => {
    const ordered = orderDriverJobs([
      job({ id: "later", startTime: "2026-09-10T15:00:00Z" }),
      job({ id: "running", isCurrent: true, status: "active" }),
      job({ id: "sooner", startTime: "2026-09-10T13:00:00Z" })
    ]);
    expect(ordered.map((j) => j.id)).toEqual(["running", "sooner", "later"]);
    expect(ordered.find((j) => j.isNext)?.id).toBe("sooner");
  });

  it("lets the centre push inserted work ahead of the rest, but never ahead of the current job", () => {
    const ordered = orderDriverJobs([
      job({ id: "planned", startTime: "2026-09-10T13:00:00Z" }),
      job({ id: "running", isCurrent: true, status: "active" }),
      job({ id: "inserted", urgent: true, startTime: "2026-09-10T16:00:00Z" })
    ]);
    expect(ordered.map((j) => j.id)).toEqual(["running", "inserted", "planned"]);
  });

  it("sinks finished and cancelled work to the bottom of the card", () => {
    const ordered = orderDriverJobs([
      job({ id: "done", status: "completed", startTime: "2026-09-10T07:00:00Z" }),
      job({ id: "scrapped", status: "cancelled", startTime: "2026-09-10T08:00:00Z" }),
      job({ id: "todo", startTime: "2026-09-10T14:00:00Z" }),
      job({ id: "running", isCurrent: true, status: "active" })
    ]);
    expect(ordered.map((j) => j.id)).toEqual(["running", "todo", "done", "scrapped"]);
  });
});
