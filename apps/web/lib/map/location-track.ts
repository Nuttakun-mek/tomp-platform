// The recent path of one vehicle, built from the pings the phone actually sent.
//
// The map used to build its trail in the browser from whatever position each
// poll happened to return (every 10–30 s, and not at all while the tab was in
// the background), then join those with straight lines. A car turning two
// corners between polls came out as one line through the buildings, and a
// signal gap came out as a solid line from where the signal was lost to where
// it came back, as if the car had driven it.

/** [latitude, longitude, recordedAt epoch ms] */
export type TrackPoint = [number, number, number];

export interface TrackPingInput {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: string;
}

/** How far back the trail reaches. */
export const TRACK_WINDOW_MS = 10 * 60 * 1000;
/** A fix this coarse says where the tower is, not where the car is. */
const TRACK_MAX_ACCURACY_M = 50;
/** Points closer than this add weight to the payload and nothing to the line. */
const TRACK_MIN_STEP_M = 10;
const TRACK_MAX_POINTS = 400;
/**
 * Longer than any healthy interval: a moving phone reports every few seconds,
 * a parked one every two minutes (120 s + slack). A longer silence is a gap in
 * the signal, and the route across it is unknown.
 */
export const TRACK_GAP_MS = 150 * 1000;

export function distanceMeters(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Pings in any order → the thinned trail, oldest first. */
export function buildTrack(pings: TrackPingInput[], now = Date.now()): TrackPoint[] {
  const since = now - TRACK_WINDOW_MS;
  const usable = pings
    .map((ping) => ({ ...ping, at: Date.parse(ping.recordedAt) }))
    .filter(
      (ping) =>
        Number.isFinite(ping.at) &&
        ping.at >= since &&
        Number.isFinite(ping.latitude) &&
        Number.isFinite(ping.longitude) &&
        (ping.latitude !== 0 || ping.longitude !== 0) &&
        (ping.accuracy == null || ping.accuracy <= TRACK_MAX_ACCURACY_M)
    )
    .sort((a, b) => a.at - b.at);

  const track: TrackPoint[] = [];
  for (const ping of usable) {
    const last = track[track.length - 1];
    const gap = last ? ping.at - last[2] : 0;
    // Keep a point after a gap even when it is close: it marks where the gap ends.
    if (last && gap <= TRACK_GAP_MS && distanceMeters([last[0], last[1]], [ping.latitude, ping.longitude]) < TRACK_MIN_STEP_M) continue;
    track.push([ping.latitude, ping.longitude, ping.at]);
  }
  return track.length > TRACK_MAX_POINTS ? track.slice(-TRACK_MAX_POINTS) : track;
}

export interface TrackSegments {
  /** Stretches the phone reported continuously: draw solid. */
  driven: Array<Array<[number, number]>>;
  /** Where the signal was lost and where it came back: draw dashed, the path between is unknown. */
  gaps: Array<[[number, number], [number, number]]>;
}

export function splitTrack(track: TrackPoint[]): TrackSegments {
  const driven: TrackSegments["driven"] = [];
  const gaps: TrackSegments["gaps"] = [];
  let current: Array<[number, number]> = [];
  track.forEach((point, index) => {
    const latLng: [number, number] = [point[0], point[1]];
    const previous = track[index - 1];
    if (previous && point[2] - previous[2] > TRACK_GAP_MS) {
      if (current.length > 1) driven.push(current);
      gaps.push([[previous[0], previous[1]], latLng]);
      current = [];
    }
    current.push(latLng);
  });
  if (current.length > 1) driven.push(current);
  return { driven, gaps };
}
