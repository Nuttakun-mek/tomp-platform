# 978 — Web/App Contract Boundary

Opened 2026-09-16 to keep web-side work and mobile-app work from breaking each
other while both agents move in parallel.

## Current Status, 2026-09-22

This file is still the source of truth for the web/mobile boundary.

Updates verified in code:

- `packages/driver-core/src/bridge.ts` remains the single shared bridge
  contract.
- `gps.status.request` is implemented in the shared bridge, handled by the
  native shell, and sent by the web GPS card on mount.
- Native background GPS diagnostics are no longer silent in the current source:
  background task errors, missing locations, session read failures and missing
  sessions are reported or queued as diagnostic location events.
- `apps/mobile-driver/src/services/offline-queue.ts` has a re-entrancy guard for
  `flushOfflineQueue()`.
- Web fallback GPS now also sends `metadata.platform`, `metadata.mode`, and
  `metadata.appBuild` so Mission Control/debugging can distinguish browser,
  WebView and native pings.
- Driver message and issue sends now use `metadata.clientEventId`; the web send
  path reconciles optimistic pending messages instead of relying on polling to
  make them disappear/reappear.
- The current-assignment resolver is Call Sign/session aware, so a driver can
  continue to the next same-day job without being forced through preflight
  photos/readiness again.

Still open at the contract level:

- Do not change `/api/driver/*`, `x-driver-session`, bridge message types, or
  GPS metadata shape without updating this file and coordinating the mobile
  agent.
- Real-device verification is still required before a native release: Android
  background GPS with locked screen, iOS background behavior, camera/photo
  attach with location stamp, push/unread badge, and sign-out/rescan.
- Keep old driver route support until the replacement Android/iOS build is
  installed on every active driver device.

## Rule

This track changes the **web application only**. The mobile app is owned by the
mobile agent. Do not edit `apps/mobile-driver/*` in this track unless the owner
explicitly asks for a cross-platform fix.

If the web side must change an API contract, schema, auth header, bridge message
or database write shape used by the app, document it here first and call it out
in the final report.

## System Boundary

The supported data path is:

`Mobile Driver App -> Next.js API /api/driver/* -> Supabase/Postgres -> Web Mission Control`

The mobile app must not write to Supabase directly. The web server remains the
authoritative boundary for project, assignment, driver, vehicle and call sign
identity.

## Shared Auth Contract

Native driver requests use:

```http
x-driver-session: <signed mobile driver session>
```

The web server resolves that header through `apps/web/lib/api/driver-token.ts`.
The client should not send trusted `projectId`, `assignmentId`, `callSignId` or
`driverId` values for operational writes. The server derives them from the
session.

Do not rename this header without a coordinated mobile app change.

## Mobile-Facing API Contract

| Purpose | Endpoint | Method | Auth | Writes/Reads |
|---|---|---:|---|---|
| Exchange mobile session | `/api/driver/mobile-session/exchange` | POST | challenge code + installation id | `driver_mobile_sessions` |
| Read current assignment | `/api/driver/assignment` | GET | `x-driver-session` | assignment packet, project, assignment, call sign, driver, vehicle |
| Send GPS | `/api/driver/location` | POST | `x-driver-session` | `gps_locations`, `driver_location_sessions`, timeline |
| Submit readiness | `/api/driver/readiness` | POST | `x-driver-session` | driver readiness/check-in action |
| Submit task status | `/api/driver/status` | POST | `x-driver-session` | assignment status action |
| Send message or issue | `/api/driver/issue` | POST | `x-driver-session` | `driver_issue_reports` |
| Upload driver message photo | `/api/driver/message-photo` | POST multipart | driver session cookie/header | storage bucket `driver-evidence` |
| Register push token | `/api/driver/push-token` | POST | `x-driver-session` | `driver_mobile_sessions.metadata` |
| Poll driver updates | `/api/driver/updates` | GET | driver session cookie/header | notifications, route changes, status |
| Upload evidence | `/api/driver/evidence` | POST | driver session cookie/header | storage bucket `driver-evidence` |

## WebView Bridge Contract

The bridge is only for communication between the web driver page inside the
native shell and the native shell itself. It is not a backend API.

Current bridge messages to preserve:

- `mobile-session.challenge`
- `mobile-session.set`
- `gps.start`
- `gps.stop`
- `gps.status.request`
- `driver.notification.unread`
- native status events such as `session_ready`, `gps_sharing`, `gps_stopped`,
  `gps_error`, `session_missing`

If the web driver page changes GPS controls, session handshake or notification
indicators, verify the bridge message shape before merging.

## Mission Control Read Path

Mission Control reads app-submitted data through web APIs and server data
helpers:

- map/location feed: `/api/mission-control/locations?projectId=...`
- comms/status/evidence feed: `/api/mission-control/comms?projectId=...`
- database tables: `gps_locations`, `driver_issue_reports`,
  `driver_notifications`, `driver_location_sessions`, `driver_assignment_packets`,
  `route_change_instructions`

When changing any write route above, also verify that these feeds still render
the expected project, call sign, driver, vehicle, status, timestamp and GPS
freshness.

## GPS Payload Requirements

`/api/driver/location` expects the schema from `packages/types/schemas.ts`.
GPS payloads should include:

- `latitude`
- `longitude`
- `accuracy`
- `recordedAt`
- `trackingEvent`: `sharing_started`, `location_ping`, or `sharing_stopped`
- `metadata.clientEventId` for idempotency
- `metadata.appBuild` when sent from native app
- `metadata.mode`: `foreground`, `background`, `heartbeat`, or diagnostic mode

Do not remove `clientEventId`. It prevents duplicate GPS writes when offline
queue flushes or background tasks retry.

## Driver Message Idempotency

`POST /api/driver/issue` remains backward compatible, but message/issue payloads
should include:

- `metadata.clientEventId`

The web side now creates this value for driver messages and issue reports. The
server returns the existing row as success when the same driver/session sends the
same `clientEventId` again. Native app code should keep this key stable while an
offline message is retried.

## Coordination Checklist For Web Changes

Before a web change is merged, answer these:

1. Did any `/api/driver/*` request or response shape change?
2. Did any schema in `packages/types/schemas.ts` change?
3. Did any driver session, PIN, QR or mobile session rule change?
4. Did any bridge message type/payload change?
5. Did Mission Control still receive GPS, status, message and evidence data?
6. Does the mobile app need a rebuild, or is a web deploy enough?

If any answer is yes, call it out in the final report and coordinate with the
mobile agent before deployment.

## 2026-09-16 Web Contract Addition

The web driver page now supports photo messages without changing the existing
mobile JSON contract:

- `/api/driver/issue` remains the authoritative message/issue write route.
- `/api/driver/message-photo` uploads a stamped image to the private
  `driver-evidence` bucket and returns a storage path.
- the message then stores `metadata.attachment` on `driver_issue_reports`.
- Mission Control and the driver thread read that metadata and request signed
  URLs server-side.

Mobile app work does **not** need to call this route unless the native app later
adds its own photo-message composer. If it does, keep the same metadata shape:

```json
{
  "attachment": {
    "type": "photo",
    "storagePath": "...",
    "capturedAt": "2026-09-16T06:00:00.000Z",
    "latitude": 13.7563,
    "longitude": 100.5018,
    "accuracy": 12,
    "hasLocation": true,
    "stampApplied": true
  }
}
```

## Current Web-Only Work From 977

Safe to do in this web track:

- fix project-wide observer/fleet QR expiry
- fix date-only inclusive operating-day duration
- improve observer-link issue UX and expiry display
- rework resources/management flow without moving QR issuance into resources
- add driver message photo support through web APIs/storage
- improve web UI states, tooltips, responsive layout and Mission Control views

Not in this web track:

- native safe-area/tab layout in `apps/mobile-driver`
- native GPS background diagnostics
- Android/iOS build, submit or distribution
- Expo, APNs, Firebase or TestFlight operations unless the owner explicitly asks

## Notes From The Mobile Track (added by the mobile agent, 2026-09-16)

**The current UI pass changes no contract.** It touches only
`apps/mobile-driver/App.tsx` and `src/theme.ts` — safe areas, type scale,
spacing, colour tokens and touch targets. No bridge message, endpoint, header or
payload changes, so the web track needs no rebuild and no coordination for it.

**Two values the shell injected were not true, and are being corrected app-side:**

- `platform` was hard-coded to `"android"` in `bridgeBootstrap`, on both
  platforms. Nothing on the web reads it today, so nothing is broken — but do
  not start branching on it until the fix ships. It now reports the real
  `Platform.OS`.
- `canBackgroundLocation` was hard-coded to `true`. The web **does** read it
  (`driver-location-share.tsx:205,254`) to decide whether to hand GPS to the
  shell instead of the browser. On iOS with only "While Using" granted, the web
  was told background tracking was available when it was not. It now reflects
  what the OS actually granted, so **expect `false` on some iPhones** and keep
  the browser fallback path working.

**Photo messages (977 §3) — where the boundary actually is.** The app does not
call the new photo endpoints; the driver web page inside the WebView does. So
those routes are web-owned end to end. The one app-side dependency is that
`<input type="file" accept="image/*" capture="environment">` must open the camera
inside the WebView. Check-in already does this, so it is expected to work —
**but it needs one real device per platform to confirm**, and if Android refuses
the file chooser it is a `react-native-webview` setting and the only part of that
feature needing a new build. Tell the mobile agent rather than adding a
workaround on the web side.

**Rebuild rule of thumb for question 6 of the checklist:** anything under
`apps/web/**` reaches drivers on the next deploy, because the driver screens are
served into the WebView. Only `apps/mobile-driver/**` needs a build.
