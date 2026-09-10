import { describe, expect, it } from "vitest";
import { gpsFreshness, gpsFreshnessLabelTh, gpsFreshnessTone , GPS_IDLE_SECONDS } from "./gps-freshness";

const NOW = new Date("2026-09-08T12:00:00Z").getTime();
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

describe("gpsFreshness", () => {
  it("treats a stopped share as stopped regardless of age", () => {
    expect(gpsFreshness(ago(2), "sharing_stopped", NOW)).toBe("stopped");
  });

  it("buckets by age around the 35s / 120s thresholds", () => {
    expect(gpsFreshness(ago(0), null, NOW)).toBe("live");
    expect(gpsFreshness(ago(35), null, NOW)).toBe("live");
    expect(gpsFreshness(ago(36), null, NOW)).toBe("slow");
    expect(gpsFreshness(ago(120), null, NOW)).toBe("slow");
    expect(gpsFreshness(ago(121), null, NOW)).toBe("offline");
  });

  it("is offline when there is no usable timestamp", () => {
    expect(gpsFreshness(null, null, NOW)).toBe("offline");
    expect(gpsFreshness("not-a-date", null, NOW)).toBe("offline");
  });

  it("clamps clock-skewed future stamps to live", () => {
    expect(gpsFreshness(new Date(NOW + 5000), null, NOW)).toBe("live");
  });
});

describe("labels and tones", () => {
  it("maps every state to a Thai label and a tone", () => {
    expect(gpsFreshnessLabelTh("live")).toBe("GPS สด");
    expect(gpsFreshnessLabelTh("stopped")).toBe("หยุดแชร์");
    expect(gpsFreshnessTone("live")).toBe("success");
    expect(gpsFreshnessTone("slow")).toBe("warning");
    expect(gpsFreshnessTone("offline")).toBe("danger");
  });
});

describe("parked driver heartbeat", () => {
  const now = Date.parse("2026-01-01T12:00:00.000Z");
  const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

  it("reads an idle-flagged ping as parked, not offline, inside the heartbeat window", () => {
    // 4 minutes is past GPS_SLOW_SECONDS but well inside a 5-minute heartbeat.
    expect(gpsFreshness(ago(240), "location_ping", now, { idle: true })).toBe("idle");
    expect(gpsFreshness(ago(240), "location_ping", now)).toBe("offline");
  });

  it("still goes offline once the driver misses their heartbeat", () => {
    expect(gpsFreshness(ago(GPS_IDLE_SECONDS + 30), "location_ping", now, { idle: true })).toBe("offline");
  });

  it("a fresh idle ping is parked rather than live", () => {
    expect(gpsFreshness(ago(5), "location_ping", now, { idle: true })).toBe("idle");
    expect(gpsFreshness(ago(5), "location_ping", now)).toBe("live");
  });

  it("stopping sharing still wins over the idle flag", () => {
    expect(gpsFreshness(ago(5), "sharing_stopped", now, { idle: true })).toBe("stopped");
  });
});
