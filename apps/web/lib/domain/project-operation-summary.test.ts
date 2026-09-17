import { describe, expect, it } from "vitest";
import { summariseProjectOperation } from "./project-operation-summary";

const NOW = new Date("2026-09-17T10:00:00.000Z").getTime();
const secondsAgo = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

const empty = { vehicles: [], drivers: [], callSigns: [], locations: [], now: NOW };

describe("summariseProjectOperation", () => {
  it("reports zeroes for a project nothing has been added to yet", () => {
    expect(summariseProjectOperation(empty)).toEqual({
      vehicles: 0,
      drivers: 0,
      crewedUnits: 0,
      totalUnits: 0,
      reportingPositions: 0
    });
  });

  it("counts a unit as ready only when it has both a driver and a vehicle", () => {
    const summary = summariseProjectOperation({
      ...empty,
      callSigns: [
        { status: "active", driverId: "d1", vehicleId: "v1" },
        { status: "active", driverId: "d2", vehicleId: null },
        { status: "active", driverId: null, vehicleId: "v3" },
        { status: "active" }
      ]
    });
    expect(summary.crewedUnits).toBe(1);
    expect(summary.totalUnits).toBe(4);
  });

  it("leaves an inactive unit out of both sides of the ratio", () => {
    const summary = summariseProjectOperation({
      ...empty,
      callSigns: [
        { status: "active", driverId: "d1", vehicleId: "v1" },
        { status: "archived", driverId: "d2", vehicleId: "v2" }
      ]
    });
    // Not 1/2: a retired unit is not work waiting to be crewed.
    expect(summary.crewedUnits).toBe(1);
    expect(summary.totalUnits).toBe(1);
  });

  it("counts a parked phone as reporting and a stale one as not", () => {
    const summary = summariseProjectOperation({
      ...empty,
      locations: [
        { recordedAt: secondsAgo(10) },
        { recordedAt: secondsAgo(10), metadata: { idle: true } },
        { recordedAt: secondsAgo(60 * 60) },
        { recordedAt: secondsAgo(5), sharingEvent: "sharing_stopped" }
      ]
    });
    // Live and idle count; an hour-old fix and a driver who stopped sharing do not.
    expect(summary.reportingPositions).toBe(2);
  });

  it("passes vehicle and driver counts straight through", () => {
    const summary = summariseProjectOperation({
      ...empty,
      vehicles: [{ id: "v1" }, { id: "v2" }, { id: "v3" }],
      drivers: [{ id: "d1" }, { id: "d2" }]
    });
    expect(summary.vehicles).toBe(3);
    expect(summary.drivers).toBe(2);
  });
});
