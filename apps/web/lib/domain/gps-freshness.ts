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
 * How long a device that reports its own cadence may go quiet before the board
 * gives up on it.
 *
 * Between the fresh window above and this one, the unit reads as parked rather
 * than missing. That band exists because of how Android actually behaves: once
 * the device stops moving and the screen goes off it defers background work,
 * foreground service or not, and the app can only send a heartbeat when the OS
 * hands it a location. Measured on a real driver on 2026-09-11 — pings every 32s
 * while the vehicle moved, then 175s, then 401s once it stopped.
 *
 * The band is keyed on the cadence being reported at all, deliberately **not**
 * on whether the last ping was flagged idle. Keying it on the flag was the first
 * attempt and it broke in traffic: a vehicle creeping forward more than
 * LOCATION_MOVED_METERS sends that ping as moving, so the next deferral was
 * judged against the tight window and a driver sitting in a jam went red. Stop-
 * and-go is the normal state of a Bangkok shift, not an edge case.
 *
 * Fifteen minutes is chosen against what the states look like from the server:
 * a throttled-but-healthy device keeps trickling pings — minutes apart, but they
 * arrive — while a phone that is dead, killed, or has stopped sharing sends
 * nothing further at all. Fifteen minutes is past any deferral seen in practice
 * and still soon enough that a dispatcher hears about a genuinely lost vehicle
 * while it matters.
 */
export const GPS_THROTTLED_SECONDS = 15 * 60;

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
    // Late, but not gone. A device only falls this far behind when it has been
    // sitting still long enough for the OS to defer it — so "parked" is not a
    // guess here, it is what the silence means.
    if (ageSeconds <= GPS_THROTTLED_SECONDS) return "idle";
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
