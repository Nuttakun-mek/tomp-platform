// One definition of "how fresh is this GPS ping". The 35s/120s thresholds and
// the age→bucket logic used to be copy-pasted into five components, so tuning
// the window meant editing five files and hoping they stayed in sync.

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
 * offline. One late POST — a tunnel, a retry — should not turn the card red.
 */
export const GPS_HEARTBEAT_SLACK_SECONDS = 60;

type Recorded = string | number | Date | null | undefined;

/** True when the driver's app said this fix was sent while standing still. */
export function isIdlePing(metadata: unknown): boolean {
  return Boolean(metadata && typeof metadata === "object" && (metadata as Record<string, unknown>).idle === true);
}

/**
 * How often this device promised to report, in seconds, or null when it did not
 * say — a browser share, or an app build older than the cadence field.
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

  // When the device tells us how often it reports, judge it against its own
  // promise. Measuring a 2-minute heartbeat against a 35s/120s scale tuned for
  // browser GPS turns every parked driver red: the last ping before stopping is
  // a *moving* one, and nothing follows it until the heartbeat comes due.
  if (cadence !== null) {
    if (ageSeconds <= cadence + GPS_HEARTBEAT_SLACK_SECONDS) return idle ? "idle" : "live";
    return "offline";
  }

  if (ageSeconds <= GPS_LIVE_SECONDS) return idle ? "idle" : "live";
  if (idle) return ageSeconds <= GPS_IDLE_SECONDS ? "idle" : "offline";
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
