# 991 — GPS presets and the battery baseline

Recorded 2026-10-02, before any GPS tuning, so later changes can be compared
with what ran before on real shifts.

## How it works

- `apps/mobile-driver/src/services/gps-presets.ts` holds the GPS settings as
  named presets. `ACTIVE_GPS_PRESET` is what the bundle runs.
- Every ping carries `metadata.gpsPreset`. Pings from before presets existed
  have none and ran `baseline`.
- `node scripts/gps-preset-report.mjs [--days N]` (read-only) compares presets:
  pings per device-hour by mode, accuracy, and the gaps between pings.
- **Never edit a preset that has shipped.** Add a new one, point
  `ACTIVE_GPS_PRESET` at it, publish by OTA, and compare. Going back is one line.
- Battery level is not on the pings yet; it needs a native module
  (`expo-battery`) and therefore a build (v1.1). Until then pings per hour is
  the proxy for the radio work a preset costs.

## The `baseline` preset (App Store 1.0.0 build 12, as shipped)

| | Foreground watcher (app open) | Background task |
|---|---|---|
| Accuracy | High | High |
| Android | every 10 s | every 30 s |
| iOS | every 30 m moved | continuous (distance 0) — keeps iOS from suspending a parked phone |

Send rule (`@tomp/driver-core`): a ping when moved ≥ 30 m, otherwise a heartbeat
every 2 min; the heartbeat clock checks every 30 s.

## Baseline numbers, 2026-09-25 → 2026-10-02

One iPhone (Van-01), `scripts/gps-preset-report.mjs --days 7`:

| Mode | Pings | Device-hours | Pings / device-hour | Avg accuracy | p90 accuracy |
|---|---|---|---|---|---|
| foreground | 245 | 7 | 35.0 | 30 m | 39 m |
| background | 183 | 8 | 22.9 | 29 m | 44 m |
| heartbeat | 8 | 6 | 1.3 | 14 m | 26 m |

Gaps between pings: median 10 s, p90 121 s, 2 quiet stretches of 5–60 min.

Peak hours, app open while moving: 130–200 pings/h (both watchers sending:
134 foreground + 62 background in 30 Sep 18:00–19:00).

## What changed on 2026-10-02 without touching the preset

Shipped by web deploy + OTA, preset still `baseline`:

- Clock-out ("สิ้นสุดปฏิบัติงาน") stops GPS sharing.
- The driver page no longer holds a screen wake lock inside the app.
- The driver page polls every 60 s instead of 15 s when no job is under way.

## Candidates for the next preset (not shipped)

- **Parked mode** — lower accuracy after 5 min stationary, back to High on
  movement. Risk: on iOS a suspended app drops off the map; Balanced accuracy
  once produced identical cell-tower fixes that hid a moving vehicle. Needs a
  device test.
- **Batching** — send moving pings in groups every 30–60 s. Cuts radio wake-ups,
  but the control room's map would lag by up to that long. A product decision.
- **One watcher** — stopping the foreground watcher once the background task
  runs. Low gain: both OSes merge the two requests onto one GPS session.
