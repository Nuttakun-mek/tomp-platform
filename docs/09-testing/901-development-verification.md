# Development Verification

## Latest Command Results

Run date: 2026-06-30.

| Command | Result |
| --- | --- |
| `npm.cmd install` | Passed; npm audit reports 7 dependency findings requiring separate review |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run lint` | Passed |
| `npm.cmd run test` | Passed: 6 test files, 13 tests |
| `NEXT_TELEMETRY_DISABLED=1 npm.cmd run build` | Passed after clearing stale `.next`; 17 routes generated |

## What Passed

- Workspace dependency install completed.
- TypeScript compiled for `apps/web`.
- ESLint completed with no errors.
- Vitest completed with 6 passing files and 13 passing tests.
- Next.js production build completed and generated 17 routes, including driver location and Mission Control location APIs.
- Thai-first UI and driver live location pilot build successfully.

## Notes From This Verification

- `npm.ps1` may be blocked by Windows execution policy, so verification used `npm.cmd`.
- Next.js build is slow inside the OneDrive workspace; interrupted builds can leave stale `.next` manifests. Stop stale Node processes and clear `.next` before rerunning build.
- npm audit findings were not force-fixed because that may introduce dependency changes outside the UI hardening scope.

## Not Tested Yet

- Full Thai pilot scenario with real operation users and drivers.
- RLS behavior with real authenticated users.
- Supabase seed `database/seed/0002_thai_pilot_scenario.sql` against a freshly reset database.
- Production deployment environment variable validation.
- Real Supabase Auth session persistence across browser refreshes.
- Supabase Storage bucket policy and signed URL review.
- Supabase Realtime delivery and reconnect behavior under real operations.
- Real mobile browser geolocation on a Vercel HTTPS deployment.
- Driver QR token expiry and revoke UX with real tokens.
- End-to-end browser automation for the Thai pilot path.

## Local Verification Checklist

1. Run `npm.cmd install`.
2. Run `npm.cmd run typecheck`.
3. Run `npm.cmd run lint`.
4. Run `npm.cmd run test`.
5. Stop any local dev server if build conflicts with `.next`.
6. Clear `apps/web/.next` if a previous build was interrupted.
7. Run `NEXT_TELEMETRY_DISABLED=1 npm.cmd run build`.
8. Apply migrations in order to Supabase through `database/migrations/0011_driver_live_location_pilot.sql`.
9. Run `database/seed/0001_demo_kernel.sql`.
10. Run `database/seed/0002_thai_pilot_scenario.sql`.
