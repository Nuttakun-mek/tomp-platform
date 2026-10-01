import * as Location from "expo-location";
import { LOCATION_HEARTBEAT_MS, LOCATION_MOVED_METERS } from "@tomp/driver-core";

// GPS settings as named presets, so a change to how the phone tracks can be
// compared with what ran before — on real shifts, not by memory. Every ping
// carries the id of the preset that sent it (metadata.gpsPreset); pings from
// before presets existed have none and ran `baseline`.
//
// Do not edit a preset that has shipped: add a new one and point ACTIVE at it,
// so the old id keeps meaning what its pings measured.
// scripts/gps-preset-report.mjs compares them; docs/11-codex/991 records the
// baseline's numbers.

export interface GpsPreset {
  id: string;
  /** What changed, for whoever reads the comparison. */
  note: string;
  /** The watcher that runs while the app is open. */
  foreground: {
    accuracy: Location.Accuracy;
    /** Android only — iOS ignores it. */
    timeIntervalMs: number;
    /** iOS: the distance gate. Android uses 0 and is bounded by time. */
    iosDistanceMeters: number;
  };
  /** The background task that keeps sending with the screen off. */
  background: {
    accuracy: Location.Accuracy;
    timeIntervalMs: number;
    distanceMeters: number;
  };
  /** How often the heartbeat clock checks whether a parked phone is due. */
  heartbeatTickMs: number;
  /** The send rule (driver-core), recorded for the comparison. */
  sendRule: { movedMeters: number; heartbeatMs: number };
}

export const GPS_PRESETS = {
  // As shipped in App Store 1.0.0 (12) and running on 2026-10-02: high accuracy
  // in both watchers, a continuous background stream, sends on every 30 m moved
  // or every 2 min parked. Measured: 130–200 pings/h with the app open while
  // moving, 16–20/h in the background (docs/11-codex/991).
  baseline: {
    id: "baseline",
    note: "1.0.0 (12) as shipped: High accuracy, foreground 10s (Android) / 30 m (iOS), background 30s / 0 m",
    foreground: { accuracy: Location.Accuracy.High, timeIntervalMs: 10_000, iosDistanceMeters: LOCATION_MOVED_METERS },
    background: { accuracy: Location.Accuracy.High, timeIntervalMs: 30_000, distanceMeters: 0 },
    heartbeatTickMs: 30_000,
    sendRule: { movedMeters: LOCATION_MOVED_METERS, heartbeatMs: LOCATION_HEARTBEAT_MS }
  }
} satisfies Record<string, GpsPreset>;

/** The preset this bundle runs. */
export const ACTIVE_GPS_PRESET: GpsPreset = GPS_PRESETS.baseline;
