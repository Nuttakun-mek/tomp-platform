import { describe, expect, it } from "vitest";
import {
  GPS_HEARTBEAT_SLACK_SECONDS,
  GPS_IDLE_HEARTBEAT_SLACK_SECONDS,
  GPS_IDLE_SECONDS,
  gpsFreshness,
  gpsFreshnessLabel,
  gpsFreshnessLabelTh,
  gpsFreshnessTone,
  pingCadenceSeconds,
  type GpsFreshness
} from "./gps-freshness";

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

  it("labels every state in both languages", () => {
    const states: GpsFreshness[] = ["live", "idle", "slow", "offline", "stopped"];
    for (const state of states) {
      expect(gpsFreshnessLabel(state, "th")).toBe(gpsFreshnessLabelTh(state));
      expect(gpsFreshnessLabel(state, "en")).toMatch(/^[\x20-\x7E]+$/);
    }
  });
});

describe("parked driver heartbeat", () => {
  const now = Date.parse("2026-01-01T12:00:00.000Z");
  const agoFrom = (seconds: number) => new Date(now - seconds * 1000).toISOString();

  it("reads an idle-flagged ping as parked, not offline, inside the heartbeat window", () => {
    expect(gpsFreshness(agoFrom(240), "location_ping", now, { idle: true })).toBe("idle");
    expect(gpsFreshness(agoFrom(240), "location_ping", now)).toBe("offline");
  });

  it("still goes offline once the driver misses their heartbeat", () => {
    expect(gpsFreshness(agoFrom(GPS_IDLE_SECONDS + 30), "location_ping", now, { idle: true })).toBe("offline");
  });

  it("a fresh idle ping is parked rather than live", () => {
    expect(gpsFreshness(agoFrom(5), "location_ping", now, { idle: true })).toBe("idle");
    expect(gpsFreshness(agoFrom(5), "location_ping", now)).toBe("live");
  });

  it("stopping sharing still wins over the idle flag", () => {
    expect(gpsFreshness(agoFrom(5), "sharing_stopped", now, { idle: true })).toBe("stopped");
  });
});

describe("a device that reports its own cadence", () => {
  const now = Date.parse("2026-01-01T12:00:00.000Z");
  const agoFrom = (seconds: number) => new Date(now - seconds * 1000).toISOString();
  const app = (extra: Record<string, unknown> = {}) => ({ heartbeatMs: 120_000, platform: "mobile_driver", ...extra });

  it("does not call a driver offline for a gap their own cadence allows", () => {
    expect(gpsFreshness(agoFrom(100), "location_ping", now, app())).toBe("live");
    expect(gpsFreshness(agoFrom(100), "location_ping", now)).toBe("slow");
    expect(gpsFreshness(agoFrom(180), "location_ping", now, app())).toBe("live");
    expect(gpsFreshness(agoFrom(180), "location_ping", now)).toBe("offline");
  });

  // These two numbers are not invented. They were measured from one driver on
  // 2026-09-11: pings every 32s while the vehicle moved, then 175s and 401s once
  // it stopped, because Android defers background work exactly when the device
  // stops moving. Against the old 180s limit the 401s gap turned a parked driver
  // red, which is what the control room reported.
  it("survives the gaps Android actually produces once a vehicle parks", () => {
    expect(gpsFreshness(agoFrom(175), "location_ping", now, app({ idle: true }))).toBe("idle");
    expect(gpsFreshness(agoFrom(401), "location_ping", now, app({ idle: true }))).toBe("idle");
  });

  // A moving driver gets no such allowance: their pings arrive on time, so a
  // long gap really does mean something is wrong.
  it("still calls a moving driver offline on the tighter window", () => {
    expect(gpsFreshness(agoFrom(401), "location_ping", now, app())).toBe("offline");
  });

  it("counts a device as offline once it is past its cadence plus slack", () => {
    expect(gpsFreshness(agoFrom(120 + GPS_HEARTBEAT_SLACK_SECONDS), "location_ping", now, app())).toBe("live");
    expect(gpsFreshness(agoFrom(120 + GPS_HEARTBEAT_SLACK_SECONDS + 1), "location_ping", now, app())).toBe("offline");
    // and a parked one, on its own longer allowance
    expect(gpsFreshness(agoFrom(120 + GPS_IDLE_HEARTBEAT_SLACK_SECONDS), "location_ping", now, app({ idle: true }))).toBe("idle");
    expect(gpsFreshness(agoFrom(120 + GPS_IDLE_HEARTBEAT_SLACK_SECONDS + 1), "location_ping", now, app({ idle: true }))).toBe("offline");
  });

  it("keeps a parked driver parked for the whole window", () => {
    expect(gpsFreshness(agoFrom(5), "location_ping", now, app({ idle: true }))).toBe("idle");
    expect(gpsFreshness(agoFrom(170), "location_ping", now, app({ idle: true }))).toBe("idle");
    expect(gpsFreshness(agoFrom(200), "location_ping", now, app({ idle: true }))).toBe("idle");
  });

  it("never shows the amber warning for a device on a known cadence", () => {
    for (const age of [40, 90, 130, 175]) {
      expect(gpsFreshness(agoFrom(age), "location_ping", now, app())).not.toBe("slow");
    }
  });

  it("follows the cadence the device actually sent, not a hard-coded one", () => {
    const slow = { heartbeatMs: 600_000 };
    expect(gpsFreshness(agoFrom(500), "location_ping", now, slow)).toBe("live");
    expect(gpsFreshness(agoFrom(700), "location_ping", now, slow)).toBe("offline");
  });

  it("ignores a cadence that is not a usable number", () => {
    for (const bad of [{ heartbeatMs: 0 }, { heartbeatMs: -1 }, { heartbeatMs: "120000" }, { heartbeatMs: NaN }]) {
      expect(pingCadenceSeconds(bad)).toBeNull();
    }
    expect(gpsFreshness(agoFrom(100), "location_ping", now, { heartbeatMs: "120000" })).toBe("slow");
  });

  it("stopping sharing still wins over a live cadence", () => {
    expect(gpsFreshness(agoFrom(5), "sharing_stopped", now, app())).toBe("stopped");
  });
});
