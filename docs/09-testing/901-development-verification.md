# Development Verification

## Latest Command Results

Run date: 2026-06-29.

| Command | Result |
| --- | --- |
| `npm.cmd install` | Passed; npm audit reports 7 dependency findings requiring separate review |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run lint` | Passed |
| `npm.cmd run test` | Passed: 6 test files, 13 tests |
| `NEXT_TELEMETRY_DISABLED=1 npm.cmd run build` | Passed after stopping stale build/dev processes, clearing `.next`, and allowing a long build window on OneDrive; 15 routes generated |

## What Passed

- Workspace dependency install completed.
- TypeScript compiled for `apps/web`.
- ESLint completed with no errors.
- Vitest completed with 6 passing files and 13 passing tests.
- Next.js production build completed and generated 15 routes, including `/pilot-checklist`, `/mission-control`, `/driver/[token]`, `/projects/[projectId]`, and `/projects/[projectId]/assignments`.
- Thai-first UI routes render without requiring live Supabase during build.

## What Failed And Was Fixed

- PowerShell blocked `npm.ps1`; verification used `npm.cmd`, which is the Windows npm executable.
- Early build attempts timed out while stale Next.js/dev processes were still running.
- `.next` generated inside OneDrive produced stale manifest `readlink` errors after interrupted builds; stopping stale processes and clearing `.next` fixed it.
- Server-side Supabase clients now return demo fallback during `phase-production-build`, preventing build-time network handles while preserving runtime Supabase usage.

## Not Tested Yet

- Full Thai pilot scenario with real operation users and drivers.
- RLS behavior with real authenticated users.
- Supabase seed `database/seed/0002_thai_pilot_scenario.sql` against a freshly reset database.
- Production deployment environment variable validation.
- Real Supabase Auth session persistence across browser refreshes.
- Supabase Storage bucket policy and signed URL review.
- Supabase Realtime delivery and reconnect behavior under real operations.
- Driver QR token expiry and revoke UX with real tokens.
- End-to-end browser automation for the Thai pilot path.

## Local Verification Checklist

1. Run `npm.cmd install`.
2. Run `npm.cmd run typecheck`.
3. Run `npm.cmd run lint`.
4. Run `npm.cmd run test`.
5. Stop any local dev server if build conflicts with `.next`.
6. Run `NEXT_TELEMETRY_DISABLED=1 npm.cmd run build`.
7. Apply migrations in order to a local or hosted Supabase database.
8. Run `database/seed/0001_demo_kernel.sql`.
9. Run `database/seed/0002_thai_pilot_scenario.sql`.
10. Verify Thai project, mission, assignment, driver token, and timeline rows.
