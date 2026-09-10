// One definition of "how fresh is this GPS ping". The 35s/120s thresholds and
// the age→bucket logic used to be copy-pasted into five components, so tuning
// the window meant editing five files and hoping they stayed in sync.

export type GpsFreshness = "live" | "idle" | "slow" | "offline" | "stopped";

/** A ping newer than this reads as live. */
export const GPS_LIVE_SECONDS = 35;
/** Between live and this, the signal is lagging; past it, it is stale. */
export const GPS_SLOW_SECONDS = 120;
/**
 * A parked driver only heartbeats every 5 minutes (see the mobile app's
 * IDLE_HEARTBEAT_MS), so an idle-flagged ping gets that window plus slack
 * before it counts as lagging. Without this a driver waiting at a pickup shows
 * as "ขาดการอัปเดต" while everything is working.
 */
export const GPS_IDLE_SECONDS = 390;

type Recorded = string | number | Date | null | undefined;

/** True when the driver's app said this fix was sent while standing still. */
export function isIdlePing(metadata: unknown): boolean {
  return Boolean(metadata && typeof metadata === "object" && (metadata as Record<string, unknown>).idle === true);
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
  if (ageSeconds <= GPS_LIVE_SECONDS) return isIdlePing(metadata) ? "idle" : "live";
  if (isIdlePing(metadata)) return ageSeconds <= GPS_IDLE_SECONDS ? "idle" : "offline";
  if (ageSeconds <= GPS_SLOW_SECONDS) return "slow";
  return "offline";
}

export function gpsFreshnessLabelTh(freshness: GpsFreshness): string {
  switch (freshness) {
    case "live":
      return "GPS สด";
    case "idle":
      return "จอดอยู่";
    case "slow":
      return "สัญญาณช้า";
    case "offline":
      return "ขาดการอัปเดต";
    case "stopped":
      return "หยุดแชร์";
  }
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
