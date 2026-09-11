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
    if (ageSeconds <= cadence + GPS_HEARTBEAT_SLACK_SECONDS) return idle ? "idle" : "live";
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
