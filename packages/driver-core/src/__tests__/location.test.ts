import { describe, expect, it } from "vitest";
import { buildLocationPingPayload, evaluateLocationHealth, getLocationWarningMessage } from "../location";

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
