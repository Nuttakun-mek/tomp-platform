// One definition of "how fresh is this GPS ping". The 35s/120s thresholds and
// the age→bucket logic used to be copy-pasted into five components, so tuning
// the window meant editing five files and hoping they stayed in sync.

export type GpsFreshness = "live" | "slow" | "offline" | "stopped";

/** A ping newer than this reads as live. */
export const GPS_LIVE_SECONDS = 35;
/** Between live and this, the signal is lagging; past it, it is stale. */
export const GPS_SLOW_SECONDS = 120;

type Recorded = string | number | Date | null | undefined;

export function gpsFreshness(recordedAt: Recorded, sharingEvent: string | null | undefined, now: number): GpsFreshness {
  if (sharingEvent === "sharing_stopped") return "stopped";
  if (recordedAt === null || recordedAt === undefined || recordedAt === "") return "offline";
  const ms = recordedAt instanceof Date ? recordedAt.getTime() : new Date(recordedAt).getTime();
  if (Number.isNaN(ms)) return "offline";

  const ageSeconds = Math.max(0, Math.round((now - ms) / 1000));
  if (ageSeconds <= GPS_LIVE_SECONDS) return "live";
  if (ageSeconds <= GPS_SLOW_SECONDS) return "slow";
  return "offline";
}

export function gpsFreshnessLabelTh(freshness: GpsFreshness): string {
  switch (freshness) {
    case "live":
      return "GPS สด";
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
    case "slow":
      return "warning";
    case "offline":
      return "danger";
    case "stopped":
      return "neutral";
  }
}
