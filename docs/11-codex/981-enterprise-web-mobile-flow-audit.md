# 981 Enterprise Web/Mobile Flow Audit

Date: 2026-09-22
Scope: web dashboard, driver WebView pages, native mobile shell, and the data contract between them.

## Executive Summary

The current architecture is directionally correct for production: the mobile app is a native shell that hosts the driver web experience, while all operational data is exchanged through `/api/driver/*` and stored in Supabase/Postgres. The bridge is intentionally small and should stay that way: session handoff, GPS commands/status, opening external URLs, and unread message signals.

The safest enterprise path is to keep business logic on web/server, keep native code limited to device capabilities, and treat `@tomp/driver-core` as the shared contract for bridge, GPS cadence, route helpers, and diagnostics.

## Current Flow

1. Control center creates project resources, assigns Call Sign, opens assignments, and issues driver/fleet QR links.
2. Driver scans QR in the mobile shell. The shell opens `/ground-transfer/driver/<token>?view=gps` in WebView.
3. Web mints a scoped driver session after token/PIN validation, then sends `mobile-session.challenge` / `mobile-session.set` through the bridge.
4. Native app stores mobile session and uses `x-driver-session` for background-capable API calls.
5. Driver actions and web fallback GPS use cookies; native background GPS uses `x-driver-session`.
6. Server resolves the current assignment by Call Sign/session, so the same driver can continue to the next job without rescanning or repeating preflight.
7. Mission Control reads status, GPS, work session, evidence, and messages from the database/feed.

## Contract Boundaries

- `apps/web/**`: driver WebView UI, mission control, API routes, server actions, data resolution. Deploying web updates these screens without native rebuild.
- `apps/mobile-driver/**`: native shell, camera/scanner, WebView navigation, background GPS, push token, offline queue. Changes here require native build.
- `packages/driver-core/**`: shared protocol and rules. Any bridge message or GPS cadence change must start here and be tested from both sides.

Do not create business logic directly in the mobile shell unless it requires native capability. Assignment order, readiness logic, work sessions, cost calculation, and message state should remain web/server-led.

## Verified Strengths

- `gps.status.request` exists in the shared bridge and the driver GPS page requests current native GPS state on mount.
- Native `TaskManager` no longer drops background GPS failures silently; diagnostics are posted/queued as location diagnostic events.
- Offline queue has a re-entrancy guard, preventing duplicate flushes when connectivity returns.
- Driver API resolution supports `x-driver-session` and cookie sessions, and resolves the current assignment rather than trusting stale assignment IDs only.
- GPS location posts are idempotent by `metadata.clientEventId`.
- Driver message posts use client event IDs and optimistic pending state.
- Mission Control has a button to focus a driver/vehicle on the map.
- Driver next-job flow has been adjusted so a same-day continuing job can be accepted without repeating vehicle photos/readiness.

## Change Made In The 2026-09-22 Pass

- Web fallback GPS payload now includes `metadata.platform`, `metadata.mode`, and `metadata.appBuild` so browser/WebView pings are easier to distinguish from native foreground/background/heartbeat pings during operations review.
- `scripts/seed-driver-flow-test.mjs` now creates two assignments for the same Call Sign so continuation can be tested.
- `scripts/simulate-mobile-shell.mjs` now completes the first job and verifies the same mobile session resolves to the next Call Sign job, then acknowledges it.
- `scripts/driver-flow-smoke.mjs` runs seed -> simulated mobile shell -> cleanup as one command: `npm run smoke:driver-flow`.
- `scripts/driver-ops-monitor.mjs` adds a read-only operational check for stale GPS, diagnostic GPS rows, mobile-session health, and missing push tokens: `npm run monitor:driver-ops`.
- `e2e/visual-mobile-regression.spec.ts` adds opt-in visual screenshots for driver mobile, fleet public view, and Mission Control layouts.
- The driver GPS card now states when the control room last received a location.
- GPS source-of-truth decision: the confirmed operational truth is the latest GPS row accepted by the server/control center. The native shell may show local transmitter state only ("sending from device"), while the web GPS card may say the control room received the latest location after the API write succeeds.
- Control-room call decision: keep the one-tap call action in the driver message/communication screen, not as a persistent action on every driver tab.
- Safety decision for smoke: `npm run smoke:driver-flow` must target an explicit staging URL. Production is blocked unless `--allow-production` is passed deliberately.

## Enterprise Gaps To Close Next

1. Normalize all high-risk date/time controls to the design-system calendar/time picker and remove remaining native date/time inputs.
2. Move long helper copy into tooltips across resource and dispatch forms so enterprise screens stay compact.
3. Add visual baselines and run the opt-in visual suite on stable staging URLs.
4. Validate that the native shell wording and web GPS card stay aligned on real devices: native = local sending state, web/server = control-room receipt.
5. Keep the call action in the message screen and validate it opens the platform dialer from Android/iOS WebView.
6. Validate real-device scenarios before native release: Android background GPS with locked screen, iOS background behavior, camera/photo attach with location stamp, push/unread badge, and sign-out/rescan.
7. Keep `/api/driver/*` backward-compatible for the next mobile build cycle. If a route payload changes, update this note and `docs/11-codex/978-web-mobile-contract-boundary.md`.

## Design Direction

- Driver app: one task per screen, bottom menu, large touch targets, compact header, status color carried by icon/fill rather than border-only, and no accidental destructive GPS stop.
- Mission Control: prioritize exception handling. Cards should expose driver, Call Sign, vehicle, GPS freshness, current/next assignment, service-time alert, and unread message without requiring expansion.
- Resource/dispatch: finish pairing driver+vehicle+Call Sign in project resources, then use project management only for main/sub assignment scheduling and QR issuance.

## Release Guidance

- Web-only UI/server fixes can deploy without rebuilding native app.
- Bridge protocol or mobile shell behavior requires native build after web deploy is stable.
- Do not remove old driver route support until the new Android/iOS build is installed on all active driver devices.
