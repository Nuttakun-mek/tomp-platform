import type { LocaleCode } from "@/lib/i18n/locales";

// One definition of "how fresh is this GPS ping". The thresholds are shared by
// Mission Control, vehicle resources, observer tracking, and the customer fleet
// view so every screen tells the same story.
export type GpsFreshness = "live" | "idle" | "slow" | "offline" | "stopped";

/** A ping newer than this reads as live. */
export const GPS_LIVE_SECONDS = 35;
/** Between live and this, the signal is lagging; past it, it is stale. */
export const GPS_SLOW_SECONDS = 120;
/**
 * Fallback window for a ping flagged idle by an app build that does not report
 * its cadence. Newer builds send `heartbeatMs` and are judged against that.
 */
export const GPS_IDLE_SECONDS = 390;
/**
 * How long past its promised cadence a device may go before it counts as
 * offline. One late POST should not turn the card red.
 */
export const GPS_HEARTBEAT_SLACK_SECONDS = 60;
/**
 * How long the "slow signal" warning lasts before a unit is written off, counted
 * from the moment its own promised cadence lapsed.
 *
 * It is measured from the end of the fresh window rather than from the last ping,
 * so it scales with whatever the device promised. A fixed deadline could fall
 * *inside* the fresh window of a device on a slow cadence — a ten-minute
 * heartbeat against a ten-minute deadline — and declare a unit offline while it
 * was still keeping its word.
 *
 * The warning itself is why this can be generous without deceiving anyone: the
 * board says "slow signal" from the moment the link goes quiet, so nobody is
 * looking at a calm colour and believing the position is current. A long fuse is
 * only a lie when the states before it look fine.
 *
 * Seven minutes past the promise is beyond any deferral seen in practice —
 * measured gaps on a parked Android reached 401 seconds — while still bounding
 * how long a dead phone sits on the board as merely slow.
 */
export const GPS_SLOW_GRACE_SECONDS = 7 * 60;

type Recorded = string | number | Date | null | undefined;

/** True when the driver's app said this fix was sent while standing still. */
export function isIdlePing(metadata: unknown): boolean {
  return Boolean(metadata && typeof metadata === "object" && (metadata as Record<string, unknown>).idle === true);
}

/**
 * How often this device promised to report, in seconds, or null when it did not
 * say, such as a browser share or an older app build.
 */
export function pingCadenceSeconds(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const ms = (metadata as Record<string, unknown>).heartbeatMs;
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : null;
}

export function gpsFreshness(
  recordedAt: Recorded,
  sharingEvent: string | null | undefined,
  now: number,
  metadata?: unknown
): GpsFreshness {
  if (sharingEvent === "sharing_stopped") return "stopped";
  if (recordedAt === null || recordedAt === undefined || recordedAt === "") return "offline";
  const ms = recordedAt instanceof Date ? recordedAt.getTime() : new Date(recordedAt).getTime();
  if (Number.isNaN(ms)) return "offline";

  const ageSeconds = Math.max(0, Math.round((now - ms) / 1000));
  const idle = isIdlePing(metadata);
  const cadence = pingCadenceSeconds(metadata);

  if (cadence !== null) {
    // Reporting on time: believe what the ping says it was doing.
    if (ageSeconds <= cadence + GPS_HEARTBEAT_SLACK_SECONDS) return idle ? "idle" : "live";
    // Late, but not yet gone — and said so plainly. This band was first written
    // as "idle", which put a unit nobody had heard from in ten minutes on the
    // board in the same calm blue as one reporting perfectly. That reads as a
    // live connection, and a position that old is exactly when an operator most
    // needs to know not to trust it. "Slow signal" is the honest word for a
    // device whose last fix has aged past the cadence it promised.
    if (ageSeconds <= cadence + GPS_HEARTBEAT_SLACK_SECONDS + GPS_SLOW_GRACE_SECONDS) return "slow";
    return "offline";
  }

  if (ageSeconds <= GPS_LIVE_SECONDS) return idle ? "idle" : "live";
  if (idle) return ageSeconds <= GPS_IDLE_SECONDS ? "idle" : "offline";
  if (ageSeconds <= GPS_SLOW_SECONDS) return "slow";
  return "offline";
}

const GPS_FRESHNESS_LABELS: Record<LocaleCode, Record<GpsFreshness, string>> = {
  th: {
    live: "GPS สด",
    idle: "จอดอยู่",
    slow: "สัญญาณช้า",
    offline: "ขาดการอัปเดต",
    stopped: "หยุดแชร์"
  },
  en: {
    live: "Live",
    idle: "Parked",
    slow: "Slow signal",
    offline: "No update",
    stopped: "Sharing off"
  }
};

export function gpsFreshnessLabel(freshness: GpsFreshness, locale: LocaleCode): string {
  return GPS_FRESHNESS_LABELS[locale][freshness];
}

export function gpsFreshnessLabelTh(freshness: GpsFreshness): string {
  return gpsFreshnessLabel(freshness, "th");
}

export function gpsFreshnessTone(freshness: GpsFreshness): "success" | "warning" | "danger" | "neutral" {
  switch (freshness) {
    case "live":
      return "success";
    case "idle":
      return "neutral";
    case "slow":
      return "warning";
    case "offline":
      return "danger";
    case "stopped":
      return "neutral";
  }
}
