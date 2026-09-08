import { describe, expect, it } from "vitest";
import {
  buildGoogleMapsDirectionsUrl,
  checkAssignmentTimeRange,
  describeAssignmentConflicts,
  getMissingAssignmentData,
  hasAssignmentTimeConflict
} from "../assignment-rules";

describe("assignment rules", () => {
  it("accepts valid time ranges and rejects inverted ranges", () => {
    expect(checkAssignmentTimeRange({ startTime: "2026-07-15T08:00:00Z", endTime: "2026-07-15T09:00:00Z" })).toBe(true);
    expect(checkAssignmentTimeRange({ startTime: "2026-07-15T09:00:00Z", endTime: "2026-07-15T08:00:00Z" })).toBe(false);
  });

  it("detects assignment conflicts by driver or vehicle", () => {
    expect(hasAssignmentTimeConflict(
      { id: "a2", driverId: "d1", startTime: "2026-07-15T08:30:00Z", endTime: "2026-07-15T09:30:00Z" },
      [{ id: "a1", driverId: "d1", startTime: "2026-07-15T08:00:00Z", endTime: "2026-07-15T09:00:00Z" }]
    )).toBe(true);
  });

  it("reports missing assignment data", () => {
    expect(getMissingAssignmentData({ callSignId: null, driverId: null, vehicleId: "v1" })).toEqual(["call sign", "driver", "time window"]);
  });

  it("describes overlapping windows and ignores non-overlapping ones", () => {
    const existing = [
      { label: "MOVE-1", startTime: "2026-07-15T09:00:00Z", endTime: "2026-07-15T11:00:00Z" },
      { label: "MOVE-9", startTime: "2026-07-15T15:00:00Z", endTime: "2026-07-15T16:00:00Z" }
    ];
    const out = describeAssignmentConflicts({ startTime: "2026-07-15T10:00:00Z", endTime: "2026-07-15T12:00:00Z" }, existing);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/^ทับซ้อนกับงาน MOVE-1 \(\d\d:\d\d–\d\d:\d\d\)$/);
  });

  it("returns nothing when the candidate has no window", () => {
    expect(describeAssignmentConflicts({ startTime: null, endTime: null }, [{ label: "X", startTime: "2026-07-15T09:00:00Z", endTime: "2026-07-15T11:00:00Z" }])).toEqual([]);
  });

  it("builds Google Maps directions links", () => {
    expect(buildGoogleMapsDirectionsUrl("Demo Venue")).toContain("https://www.google.com/maps/dir/");
    expect(buildGoogleMapsDirectionsUrl("Demo Venue")).toContain("destination=Demo+Venue");
  });
});

