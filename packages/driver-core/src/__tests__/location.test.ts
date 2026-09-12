import { describe, expect, it } from "vitest";
import {
  buildLocationPingPayload,
  decideLocationSend,
  DIAGNOSTIC_REPORT_INTERVAL_MS,
  shouldReportDiagnostic,
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

describe("a fix too vague to prove anything", () => {
  const here = { latitude: 13.85, longitude: 100.55, at: Date.now() - 10_000 };

  // Cell-tower positions are accurate to about 100 metres and repeat the same
  // coordinates fix after fix, because the tower does not move. Read literally
  // that is "moved 0 metres", which is how a vehicle driving across town was
  // reported as parked on 2026-09-11 until a real GPS fix jumped the marker 1.2km.
  it("does not claim a vehicle is parked on a 100-metre fix", () => {
    const decision = decideLocationSend(here, 13.85, 100.55, "location_ping", Date.now(), 100);
    expect(decision.idle).toBe(false);
  });

  it("still trusts a fix precise enough to measure the distance it is judging", () => {
    const decision = decideLocationSend(here, 13.85, 100.55, "location_ping", Date.now(), 12);
    expect(decision.idle).toBe(true);
  });

  it("behaves as before when the device reports no accuracy at all", () => {
    expect(decideLocationSend(here, 13.85, 100.55, "location_ping", Date.now()).idle).toBe(true);
    expect(decideLocationSend(here, 13.85, 100.55, "location_ping", Date.now(), null).idle).toBe(true);
  });

  it("a coarse fix that did move is still movement", () => {
    const decision = decideLocationSend(here, 13.8545, 100.55, "location_ping", Date.now(), 100);
    expect(decision.send).toBe(true);
    expect(decision.idle).toBe(false);
  });
});

describe("shouldReportDiagnostic", () => {
  it("reports a reason that has never been seen", () => {
    expect(shouldReportDiagnostic(null)).toBe(true);
    expect(shouldReportDiagnostic(undefined)).toBe(true);
  });

  it("stays silent while the same reason repeats", () => {
    const now = 1_000_000;
    // The flood case: a background callback a second apart, each hitting the
    // same early exit.
    expect(shouldReportDiagnostic(now, now + 1_000)).toBe(false);
    expect(shouldReportDiagnostic(now, now + DIAGNOSTIC_REPORT_INTERVAL_MS - 1)).toBe(false);
  });

  it("reports again once the window has passed, so a lasting fault keeps saying so", () => {
    const now = 1_000_000;
    expect(shouldReportDiagnostic(now, now + DIAGNOSTIC_REPORT_INTERVAL_MS)).toBe(true);
  });
});
