import { describe, expect, it } from "vitest";
import { findDriverTimeConflicts, type SchedulableAssignment } from "./assignment-conflicts";

const a = (over: Partial<SchedulableAssignment>): SchedulableAssignment => ({
  id: over.id ?? "x",
  driverId: over.driverId ?? "d1",
  startTime: over.startTime ?? null,
  endTime: over.endTime ?? null,
  status: over.status ?? "planned"
});

describe("findDriverTimeConflicts", () => {
  it("flags two overlapping windows for the same driver", () => {
    const conflicts = findDriverTimeConflicts([
      a({ id: "1", startTime: "2026-09-09T08:00:00Z", endTime: "2026-09-09T10:00:00Z" }),
      a({ id: "2", startTime: "2026-09-09T09:00:00Z", endTime: "2026-09-09T11:00:00Z" })
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ driverId: "d1", a: "1", b: "2" });
  });

  it("does not flag back-to-back windows", () => {
    expect(
      findDriverTimeConflicts([
        a({ id: "1", startTime: "2026-09-09T08:00:00Z", endTime: "2026-09-09T09:00:00Z" }),
        a({ id: "2", startTime: "2026-09-09T09:00:00Z", endTime: "2026-09-09T10:00:00Z" })
      ])
    ).toHaveLength(0);
  });

  it("ignores different drivers and cancelled jobs", () => {
    expect(
      findDriverTimeConflicts([
        a({ id: "1", driverId: "d1", startTime: "2026-09-09T08:00:00Z", endTime: "2026-09-09T10:00:00Z" }),
        a({ id: "2", driverId: "d2", startTime: "2026-09-09T08:00:00Z", endTime: "2026-09-09T10:00:00Z" }),
        a({ id: "3", driverId: "d1", startTime: "2026-09-09T08:30:00Z", endTime: "2026-09-09T09:00:00Z", status: "cancelled" })
      ])
    ).toHaveLength(0);
  });

  it("uses a 1h assumed window when end time is missing", () => {
    const conflicts = findDriverTimeConflicts([
      a({ id: "1", startTime: "2026-09-09T08:00:00Z" }),
      a({ id: "2", startTime: "2026-09-09T08:30:00Z" })
    ]);
    expect(conflicts).toHaveLength(1);
  });

  it("skips jobs with no start time", () => {
    expect(findDriverTimeConflicts([a({ id: "1" }), a({ id: "2" })])).toHaveLength(0);
  });
});
