import { describe, expect, it } from "vitest";
import {
  GPS_HEARTBEAT_SLACK_SECONDS,
  GPS_SLOW_GRACE_SECONDS,
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

  // These numbers are not invented. They were measured from one driver on
  // 2026-09-11: pings every 32s while the vehicle moved, then 175s and 401s once
  // it stopped, because Android defers background work exactly when the device
  // stops moving. Against the old 180s limit the 401s gap turned a parked driver
  // red, which is what the control room reported.
  it("survives the gaps Android actually produces once a vehicle stops", () => {
    expect(gpsFreshness(agoFrom(175), "location_ping", now, app({ idle: true }))).toBe("idle");
    // Still on the board rather than written off — but named as a slow signal,
    // because nobody has heard from it for nearly seven minutes.
    expect(gpsFreshness(agoFrom(401), "location_ping", now, app({ idle: true }))).toBe("slow");
  });

  // The case that broke the first attempt at this. A vehicle creeping through a
  // jam moves far enough to send a ping flagged as *moving*, and is then deferred
  // like anything else standing still. Judging that gap on the tight window put a
  // driver stuck in traffic on the board as missing.
  it("does not call a driver in stop-and-go traffic offline", () => {
    expect(gpsFreshness(agoFrom(401), "location_ping", now, app())).toBe("slow");
    expect(gpsFreshness(agoFrom(600), "location_ping", now, app())).toBe("slow");
  });

  // The board must never show a calm colour for a link that has gone quiet:
  // that is a live connection to anyone reading it, at the exact moment the
  // position is least worth trusting.
  it("never reads as fresh once the promised cadence has lapsed", () => {
    for (const age of [200, 401, 600, 599]) {
      expect(["live", "idle"]).not.toContain(gpsFreshness(agoFrom(age), "location_ping", now, app({ idle: true })));
    }
  });

  it("still gives up on a device that has genuinely gone", () => {
    const gone = 120 + GPS_HEARTBEAT_SLACK_SECONDS + GPS_SLOW_GRACE_SECONDS;
    expect(gpsFreshness(agoFrom(gone), "location_ping", now, app())).toBe("slow");
    expect(gpsFreshness(agoFrom(gone + 1), "location_ping", now, app())).toBe("offline");
    expect(gpsFreshness(agoFrom(gone + 1), "location_ping", now, app({ idle: true }))).toBe("offline");
  });

  it("counts a device as offline once it is past its cadence plus slack", () => {
    expect(gpsFreshness(agoFrom(120 + GPS_HEARTBEAT_SLACK_SECONDS), "location_ping", now, app())).toBe("live");
    // Past the fresh window it reads as parked rather than missing - the point
    // of the middle band - and only turns red past GPS_THROTTLED_SECONDS.
    expect(gpsFreshness(agoFrom(120 + GPS_HEARTBEAT_SLACK_SECONDS + 1), "location_ping", now, app())).toBe("slow");
  });

  it("keeps a parked driver parked for the whole window", () => {
    expect(gpsFreshness(agoFrom(5), "location_ping", now, app({ idle: true }))).toBe("idle");
    expect(gpsFreshness(agoFrom(170), "location_ping", now, app({ idle: true }))).toBe("idle");
    expect(gpsFreshness(agoFrom(200), "location_ping", now, app({ idle: true }))).toBe("slow");
  });

  it("shows no amber warning while the device is keeping its promise", () => {
    for (const age of [40, 90, 130, 175]) {
      expect(gpsFreshness(agoFrom(age), "location_ping", now, app())).not.toBe("slow");
    }
  });

  it("follows the cadence the device actually sent, not a hard-coded one", () => {
    const slow = { heartbeatMs: 600_000 };
    // Fresh against its own ten-minute promise, where the default scale would
    // have called it lost several minutes ago.
    expect(gpsFreshness(agoFrom(500), "location_ping", now, slow)).toBe("live");
    // Past that promise it drops to parked, not missing...
    expect(gpsFreshness(agoFrom(700), "location_ping", now, slow)).toBe("slow");
    // ...and the grace runs from *its* promise, not from a fixed clock, so a
    // ten-minute cadence is never called offline while it is still keeping it.
    expect(gpsFreshness(agoFrom(600 + GPS_HEARTBEAT_SLACK_SECONDS + GPS_SLOW_GRACE_SECONDS + 1), "location_ping", now, slow)).toBe("offline");
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
