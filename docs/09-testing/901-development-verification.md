# Development Verification

## Latest Command Results

Run date: 2026-09-09.

| Command | Result |
| --- | --- |
| `npm.cmd install` | Passed |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run lint` | Passed |
| `npm.cmd run test` | Passed: 20 test files, 68 tests |
| `NEXT_TELEMETRY_DISABLED=1 npm.cmd run build` | Passed; 43 app routes generated |
| `npm.cmd run security:env` | Passed; no `NEXT_PUBLIC_*` service/secret key found in source |

## Current Verification Scope

This verification covers the Thai-first UI/UX reset UX-31 to UX-42:

- App shell redesign.
- Operations dashboard.
- Mission Control command center.
- Driver mobile workspace.
- Project workspace.
- Dispatch board.
- Resources readiness workspace.
- Guided pilot journey.
- Thai copy and UX audit documents.

## What Passed

- TypeScript compiled for `apps/web`.
- ESLint completed with no errors.
- Vitest completed with 20 passing files and 68 passing tests.
- Next.js production build completed.
- The UI reset did not add new backend business scope.
- Local production-like smoke checks passed for `/`, `/projects`, `/assignments`, `/driver`, `/live-test`, `/mission-control`, `/api/health`, `/api/admin/pilot-infrastructure`, and `/api/mission-control/locations`.

## Notes

- `npm.ps1` may be blocked by Windows execution policy, so verification used `npm.cmd`.
- `npm audit --omit=dev --audit-level=moderate` still reports existing dependency findings. They were not force-fixed because that can introduce broad dependency changes outside this stabilization sprint.
- Web GPS remains foreground-first. Background GPS after screen lock requires native or hybrid app capability.
- Supabase connectivity is still the main live-test blocker in the current environment. The UI now returns a clear `ไม่พร้อม` state instead of hanging.

## Manual Smoke Test Checklist

1. Open `/`.
2. Open `/mission-control`.
3. Open `/projects`.
4. Open a project workspace.
5. Open the Assignment dispatch board.
6. Open `/live-test` and generate a driver test link.
7. Open the driver link on mobile.
8. Start GPS sharing.
9. Confirm Mission Control shows GPS status and driver identity.
10. Open `/pilot-checklist` and follow the guided journey.

## Not Tested Yet

- Full E2E browser automation.
- Visual regression screenshots across all breakpoints.
- Fresh Supabase reset using all migrations and seed files.
- Real multi-user auth and project-scoped RBAC.
- Real mobile browser GPS under long-running field conditions.

## 2026-09-09 Flow Fix Notes

- Assignment creation no longer blocks on an empty Call Sign list; dispatchers can create a Call Sign inside the assignment form.
- Driver QR/PIN verification now has a Postgres fallback when REST writes are unavailable but direct database access is configured.
- Driver task progress reads the latest saved status after refresh.
- Driver GPS status is no longer optimistic; the UI marks GPS live only after a real ping is accepted.
- Failed driver status, message, and issue submissions are stored in a browser outbox and retried.
- Target pilot load of about 50 vehicles and 250 tasks per day is within the expected Supabase/Postgres and Vercel capacity when queries remain project-scoped and indexed.
- Production-grade background GPS still requires the future iOS/Android driver app. The web page is foreground-first.
- QR/PIN creation now has Postgres fallback when REST writes are unavailable but direct database access is configured.
- The driver task page now shows same-day assignments for the same driver and project.
- The QR panel can generate QR/PIN for all ready assignments in one operation.
- Mission Control fleet cards were rebuilt for compact scanning, GPS freshness, unread message badges, and expandable vehicle detail.
- New user-facing copy in replaced files uses formal Thai. A full copy audit is still required for older files with legacy encoding.
