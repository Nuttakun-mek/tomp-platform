# 987 Current Documentation Index

Date: 2026-09-22

Use this file as the first stop before assigning another agent.

## Read First

1. `978-web-mobile-contract-boundary.md` - source of truth for the web/mobile
   API, bridge and ownership boundary.
2. `981-enterprise-web-mobile-flow-audit.md` - current enterprise architecture
   audit, flow summary, verified strengths and release guidance.
3. `982-remaining-work.md` - current backlog. Older notes are historical unless
   an item is still repeated in `982`.
4. `988-ios-unlisted-app-store-release.md` - how the iOS app is released:
   Unlisted App Store distribution, listing text, privacy answers, reviewer demo.

## Current System Position

- Web/server remains the operational source of truth.
- Mobile app remains a native shell around the driver web experience.
- Business writes go through `/api/driver/*`.
- Native background requests use `x-driver-session`.
- Bridge messages are intentionally limited to session handoff, GPS control,
  GPS status, external URL opening and unread message indicators.
- `@tomp/driver-core` is the shared contract package for bridge and GPS send
  rules.

## Current Verified State

- Web typecheck, lint and tests pass.
- Mobile typecheck and tests pass.
- Driver-core tests pass.
- GPS idempotency and message idempotency helpers are present.
- Web fallback GPS identifies itself with `platform`, `mode`, and `appBuild`.
- Driver continuation to a next same-day job no longer requires repeated
  preflight photos/readiness.
- Mission Control driver cards expose map focus, GPS freshness, current job,
  service-time alert, unread count and cost summary.
- Driver flow smoke exists as `npm run smoke:driver-flow`; it seeds two jobs for
  one Call Sign, simulates mobile session/GPS, completes job one, and verifies
  job two can be acknowledged without a new QR.
- Driver ops monitor exists as `npm run monitor:driver-ops`.
- Opt-in visual regression exists as `npm run e2e:visual` with `E2E_VISUAL=1`
  and stable driver/fleet/mission-control URLs.
- GPS truth decision: server/control-center accepted GPS rows are the confirmed
  truth; native shell wording is local sending state only.
- Control-room call decision: call action belongs in the driver message screen.
- Driver flow smoke is staging-first and refuses production unless
  `--allow-production` is passed deliberately.

## Do Not Reopen Unless Product Decides

- Do not move QR issuance into the resources page. Resources should prepare
  driver + vehicle + Call Sign; project management issues assignments and QR.
- Do not let mobile write directly to Supabase.
- Do not remove old driver URL support until the new native build is installed
  across active devices.
- Do not add a mission dropdown back into sub-job creation when the Call Sign
  has already selected the mission context.

## Still Needs Human Or Device Confirmation

- Android and iOS real-device GPS behavior with locked screen/background.
- Camera/photo attach inside WebView on both platforms.
- Push/unread behavior while app is backgrounded.
- Sign-out/rescan behavior on iOS keychain.
- Production monitoring thresholds for GPS freshness, mobile sessions,
  diagnostic rows, and push-token registration.
- Visual screenshot baselines on a stable staging data set.
