import { describe, expect, it } from "vitest";
import {
  buildLocationPingPayload,
  decideLocationSend,
  evaluateLocationHealth,
  getLocationWarningMessage,
  LOCATION_HEARTBEAT_MS
} from "../location";

describe("driver location rules", () => {
  it("marks missing ping as offline", () => {
    expect(evaluateLocationHealth(null).status).toBe("offline");
  });

  it("builds ping payload", () => {
    const ping = buildLocationPingPayload({
      projectId: "p",
      assignmentId: "a",
      latitude: 13.75,
      longitude: 100.5,
      recordedAt: "",
      source: "driver_web_app",
      metadata: {}
    });
    expect(ping.recordedAt).toBeTruthy();
  });

  it("returns warning for unhealthy location", () => {
    expect(getLocationWarningMessage({ status: "offline", message: "ยังไม่มีสัญญาณ GPS", stale: true })).toBe("ยังไม่มีสัญญาณ GPS");
  });
});

describe("decideLocationSend", () => {
  const here = { latitude: 13.7563, longitude: 100.5018, at: 1_000_000 };

  it("always sends when there is nothing to compare against", () => {
    expect(decideLocationSend(null, 13.7563, 100.5018, "location_ping")).toEqual({ send: true, idle: false });
  });

  it("always sends a sharing start or stop, however recent the last fix", () => {
    expect(decideLocationSend(here, here.latitude, here.longitude, "sharing_started", here.at + 1)).toMatchObject({ send: true });
    expect(decideLocationSend(here, here.latitude, here.longitude, "sharing_stopped", here.at + 1)).toMatchObject({ send: true });
  });

  it("sends once the vehicle has moved, and calls it moving", () => {
    // ~100m north.
    const moved = decideLocationSend(here, here.latitude + 0.0009, here.longitude, "location_ping", here.at + 1000);
    expect(moved).toEqual({ send: true, idle: false });
  });

  it("holds a stationary fix until the heartbeat is due", () => {
    expect(decideLocationSend(here, here.latitude, here.longitude, "location_ping", here.at + 5_000)).toEqual({
      send: false,
      idle: true
    });
  });

  it("sends the heartbeat, flagged idle so the map says parked rather than missing", () => {
    const due = decideLocationSend(here, here.latitude, here.longitude, "location_ping", here.at + LOCATION_HEARTBEAT_MS);
    expect(due).toEqual({ send: true, idle: true });
  });

  it("treats a small GPS jitter as standing still", () => {
    // A few metres of drift is the receiver, not the vehicle.
    const jitter = decideLocationSend(here, here.latitude + 0.00002, here.longitude, "location_ping", here.at + 3000);
    expect(jitter).toEqual({ send: false, idle: true });
  });
});
