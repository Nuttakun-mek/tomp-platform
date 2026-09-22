# 979 — Note For Mobile Agent: Web Contract After Web-Only Changes

Date: 2026-09-16

## Current Status, 2026-09-22

This note is still valid, with the following updates:

- Web driver GPS now sends `metadata.platform = "driver_web"`,
  `metadata.mode = "web_foreground"`, and `metadata.appBuild = "web"` for
  browser/WebView fallback pings.
- The web GPS card sends `gps.status.request` on mount and on mobile shell ready.
- Driver message/issue idempotency is wired in the web send path through
  `metadata.clientEventId`.
- The next-job continuation flow now lets the driver accept the next same-day
  Call Sign job without repeating vehicle photos/readiness.
- Latest verification:
  - `npm run typecheck -w @tomp/web`: pass
  - `npm run lint -w @tomp/web`: pass
  - `npm run test -w @tomp/web`: pass, 58 files / 289 tests
  - `npm run typecheck:mobile`: pass
  - `npm run test:mobile`: pass, 6 files / 34 tests
  - `npm run test -w @tomp/driver-core`: pass, 6 files / 38 tests

The mobile agent should still run the real-device checklist before any Android
or iOS build is released.

This note is for the mobile app agent. The web agent has completed a web-only
pass and intentionally did not change `apps/mobile-driver/*`.

Use this file together with:

- `docs/11-codex/978-web-mobile-contract-boundary.md`
- `docs/11-codex/977-after-approval-backlog.md`
- `docs/11-codex/976-agent-handoff-after-the-gps-day.md`

## What Changed On Web

### 1. Project-wide fleet/observer QR expiry

Web now prevents project-wide observer links from being issued with an expiry in
the past.

Affected web files:

- `apps/web/app/actions/observer-access.ts`
- `apps/web/components/assignments/call-sign-access-panel.tsx`
- `apps/web/lib/domain/observer-expiry.ts`

Mobile impact: **none**. This is for customer/observer fleet links, not driver
QR.

### 2. Date-only duration

Web date-only ranges now count calendar days inclusively:

- 1 Sep -> 1 Sep = `1 วัน`
- 1 Sep -> 3 Sep = `3 วัน`

Mobile impact: **none**.

### 3. Driver message photo support on web

The web driver page can now attach a photo in the driver/control-room message
thread.

New web endpoint:

```http
POST /api/driver/message-photo
Content-Type: multipart/form-data
Auth: driver session cookie or x-driver-session
```

Response shape:

```json
{
  "success": true,
  "data": {
    "storagePath": "project/assignment/message-..."
  }
}
```

The actual driver message is still written through:

```http
POST /api/driver/issue
```

with `metadata.attachment` and `metadata.clientEventId`.

Metadata shape:

```json
{
  "attachment": {
    "type": "photo",
    "storagePath": "project/assignment/message-...",
    "capturedAt": "2026-09-16T06:00:00.000Z",
    "latitude": 13.7563,
    "longitude": 100.5018,
    "accuracy": 12,
    "hasLocation": true,
    "stampApplied": true
  },
  "clientEventId": "driver-message:20260916T060000000Z:..."
}
```

Mission Control and the driver web thread resolve the private storage path into a
short-lived signed URL server-side.

Mobile impact:

- If the native app continues to use the web driver page inside WebView, **no
  mobile change is required**.
- If the native app later adds a native message-photo composer, use the same
  two-step flow:
  1. upload photo to `/api/driver/message-photo`
  2. send `/api/driver/issue` with `metadata.attachment` and a stable
     `metadata.clientEventId`

Do not store signed URLs in the mobile app as durable data. Signed URLs expire.
Store only `storagePath` in message metadata.

### Driver issue/message idempotency

`POST /api/driver/issue` now treats `metadata.clientEventId` as an idempotency
key for the same project, assignment and driver. This is optional for backward
compatibility, but native app retries should provide it and keep it stable until
the message is acknowledged by the server.

## Contracts That Must Not Change Without Coordinating Web

### Header

Native requests must keep:

```http
x-driver-session: <signed mobile driver session>
```

### API Routes

Keep using these routes:

- `GET /api/driver/assignment`
- `POST /api/driver/location`
- `POST /api/driver/readiness`
- `POST /api/driver/status`
- `POST /api/driver/issue`
- `POST /api/driver/push-token`
- `GET /api/driver/updates`
- `POST /api/driver/mobile-session/exchange`

### WebView Bridge Messages

Keep these message types and bridge version:

- `mobile-session.challenge`
- `mobile-session.set`
- `gps.start`
- `gps.stop`
- `gps.status.request`
- `driver.notification.unread`
- native status: `session_ready`, `session_missing`, `gps_starting`,
  `gps_sharing`, `gps_stopped`, `gps_error`, `navigation_blocked`

The bridge source of truth is:

- `packages/driver-core/src/bridge.ts`

### GPS Payload

GPS payloads must continue to include:

- `latitude`
- `longitude`
- `accuracy`
- `recordedAt`
- `trackingEvent`
- `metadata.clientEventId`
- `metadata.appBuild`

Do not remove `metadata.clientEventId`; the web side uses it for idempotency.

## Current Verification From Web Agent

Mobile code was inspected for the data flow:

`QR/token -> WebView -> mobile-session exchange -> x-driver-session -> /api/driver/* -> Mission Control`

Checks run:

```bash
npm run typecheck:mobile
npm run test:mobile
```

Result:

- mobile typecheck: pass
- mobile tests: pass, 28 tests

Web checks from this web-only pass:

```bash
npm run typecheck -w @tomp/web
npm run lint -w @tomp/web
npm run test
NEXT_TELEMETRY_DISABLED=1 npm run build
```

Result:

- web typecheck: pass
- web lint: pass
- full test suite: pass, 247 tests
- production build: pass

## What The Mobile Agent Should Test On Device

Unit tests cannot prove OS behavior. Please test on physical devices:

1. QR scan -> PIN/session -> opens driver page.
2. Start GPS from web page inside app.
3. Mission Control receives `sharing_started` then `location_ping`.
4. Put app in background / lock screen.
5. Mission Control still receives background or diagnostic pings.
6. Send a message from Mission Control and confirm unread indicator appears in
   the app.
7. Open messages tab and confirm unread indicator clears.
8. Stop GPS from web page and confirm Mission Control receives
   `sharing_stopped`.
9. Use `สแกน QR ใหม่` / sign out and confirm:
   - GPS stops
   - session is cleared
   - old iOS keychain token does not reopen the previous QR
10. Offline test:
   - start GPS
   - turn network off
   - generate at least one queued location/status/message
   - turn network on
   - verify outbox flushes once, without duplicate location rows

## Important Coordination Note

Do not add direct Supabase writes in the mobile app. The supported path remains:

`Mobile App -> Next.js /api/driver/* -> Supabase/Postgres -> Web Mission Control`

If a mobile change requires a new field or route, update this file and
`978-web-mobile-contract-boundary.md` before building a new APK/IPA.
