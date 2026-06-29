import { describe, expect, it } from "vitest";
import { buildGoogleMapsDirectionsUrl, checkAssignmentTimeRange, getMissingAssignmentData, hasAssignmentTimeConflict } from "../assignment-rules";

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

  it("builds Google Maps directions links", () => {
    expect(buildGoogleMapsDirectionsUrl("Demo Venue")).toContain("https://www.google.com/maps/dir/");
    expect(buildGoogleMapsDirectionsUrl("Demo Venue")).toContain("destination=Demo+Venue");
  });
});

