import type { DriverLocationHealth, DriverLocationPing } from "@tomp/types/domain";

export function detectStaleLocation(recordedAt: string, staleAfterSeconds = 120) {
  const recorded = new Date(recordedAt).getTime();
  if (Number.isNaN(recorded)) return true;
  return Date.now() - recorded > staleAfterSeconds * 1000;
}

export function evaluateLocationHealth(ping?: DriverLocationPing | null): DriverLocationHealth {
  if (!ping) return { status: "offline", message: "ยังไม่มีสัญญาณ GPS", stale: true };
  const stale = detectStaleLocation(ping.recordedAt);
  if (stale) return { status: "stale", message: "สัญญาณ GPS ไม่อัปเดต", stale: true, lastPingAt: ping.recordedAt };
  if (typeof ping.accuracy === "number" && ping.accuracy > 100) {
    return { status: "weak", message: "ความแม่นยำ GPS ต่ำ", stale: false, lastPingAt: ping.recordedAt };
  }
  return { status: "healthy", message: "GPS ทำงานปกติ", stale: false, lastPingAt: ping.recordedAt };
}

export function buildLocationPingPayload(input: DriverLocationPing): DriverLocationPing {
  return { ...input, recordedAt: input.recordedAt || new Date().toISOString() };
}

export function getLocationWarningMessage(health: DriverLocationHealth) {
  return health.status === "healthy" ? null : health.message;
}

// How often a stationary driver still reports, and how far they must move
// before a fix is worth sending on its own.
//
// Both apps share this because both feed the same map. The mobile app had a
// throttle and the web page had none, so a web driver wrote a row every few
// seconds while moving and then — the moment the browser suspended the tab —
// nothing at all, which the control room reads as "ขาดการอัปเดต" on a driver
// who is simply sitting at a pickup with the screen off.
//
// The cadence rides along on every ping (`heartbeatMs`) so the control room
// measures "overdue" against what the device actually promised, rather than a
// constant that has to be kept in step by hand across two codebases.
export const LOCATION_MOVED_METERS = 30;
export const LOCATION_HEARTBEAT_MS = 2 * 60 * 1000;

export interface LastSentFix {
  latitude: number;
  longitude: number;
  at: number;
}

/** Metres between two coordinates; equirectangular is plenty at these distances. */
export function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number) {
  const toRad = Math.PI / 180;
  const x = (bLon - aLon) * toRad * Math.cos(((aLat + bLat) / 2) * toRad);
  const y = (bLat - aLat) * toRad;
  return Math.sqrt(x * x + y * y) * 6371000;
}

export interface SendDecision {
  /** Whether this fix should reach the server at all. */
  send: boolean;
  /** Whether the vehicle is standing still, which decides the map's wording. */
  idle: boolean;
}

/**
 * Should this fix be sent, and is the vehicle stationary?
 *
 * Always sent when it is not a routine ping (sharing started or stopped), when
 * there is nothing to compare against yet, when the vehicle has moved, or when
 * the heartbeat is due.
 */
export function decideLocationSend(
  lastSent: LastSentFix | null,
  latitude: number,
  longitude: number,
  trackingEvent: string,
  now = Date.now(),
  accuracyMeters?: number | null
): SendDecision {
  if (trackingEvent !== "location_ping" || !lastSent) return { send: true, idle: false };

  const moved = distanceMeters(lastSent.latitude, lastSent.longitude, latitude, longitude);
  if (moved >= LOCATION_MOVED_METERS) return { send: true, idle: false };

  // A fix cannot prove the vehicle stayed put if it is vaguer than the distance
  // being measured. Cell-tower positions are accurate to about 100 metres and
  // repeat the same coordinates fix after fix, so "moved 0 metres" was read as
  // "parked" for a vehicle driving across town — until a real GPS fix landed and
  // the marker jumped a kilometre. Where the fix is too coarse to tell, say so
  // rather than claiming the vehicle is stationary.
  const tooCoarseToTell =
    typeof accuracyMeters === "number" && Number.isFinite(accuracyMeters) && accuracyMeters > LOCATION_MOVED_METERS;

  if (now - lastSent.at >= LOCATION_HEARTBEAT_MS) return { send: true, idle: !tooCoarseToTell };
  return { send: false, idle: !tooCoarseToTell };
}

/**
 * How long one diagnostic reason stays silent after it has been reported once.
 *
 * Every early exit in the background location task fires on *every* callback,
 * and that task deliberately asks for `distanceInterval: 0` — so a driver whose
 * session cannot be read would post one diagnostic per fix, roughly one a second
 * in a moving vehicle. The flood would bury the signal it exists to produce, and
 * with no session to send it under, each one lands in the offline queue instead.
 *
 * The first occurrence is what identifies the fault; a repeat five minutes later
 * is what says it is still happening.
 */
export const DIAGNOSTIC_REPORT_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Whether a background diagnostic for `reason` should be reported now, given
 * when that same reason was last reported. Reasons are throttled independently,
 * so a session failure never masks a TaskManager error.
 */
export function shouldReportDiagnostic(lastReportedAt: number | null | undefined, now = Date.now()): boolean {
  if (lastReportedAt === null || lastReportedAt === undefined) return true;
  return now - lastReportedAt >= DIAGNOSTIC_REPORT_INTERVAL_MS;
}
