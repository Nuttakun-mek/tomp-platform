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
 * The same allowance for a device that says it is standing still.
 *
 * A parked phone cannot keep the cadence it promised, and the reason is the
 * reason it is parked: Android defers background work once the device stops
 * moving and the screen goes off, foreground service or not. Measured on a real
 * driver on 2026-09-11 — while moving the pings arrived every 32s like clockwork,
 * and the moment the vehicle stopped the gaps went 175s, then 401s, against a
 * 180s limit. The control room watched a driver standing exactly where they were
 * told to wait turn red.
 *
 * So a stationary device is judged more loosely than a moving one. The cost is
 * that a phone which genuinely dies while parked takes longer to show red; that
 * is the right trade, because a driver who parks is common and a driver whose
 * phone dies is rare, and the false red was arriving several times an hour.
 */
export const GPS_IDLE_HEARTBEAT_SLACK_SECONDS = 300;

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
    const slack = idle ? GPS_IDLE_HEARTBEAT_SLACK_SECONDS : GPS_HEARTBEAT_SLACK_SECONDS;
    if (ageSeconds <= cadence + slack) return idle ? "idle" : "live";
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
