# Development Verification

## Latest Command Results

Run date: 2026-06-29.

| Command | Result |
| --- | --- |
| `npm install` | Passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `NEXT_TELEMETRY_DISABLED=1 npm run build` | Passed |

## What Passed

- Workspace dependency install completed.
- TypeScript compiled for `apps/web`.
- ESLint completed with no errors.
- Next.js production build completed.
- App routes render as static or dynamic placeholder pages without a database connection.

## What Failed And Was Fixed

- No command failures remained in the latest verification pass.
- Package subpath exports for `@tomp/types/domain` and `@tomp/types/schemas` were hardened before this verification.

## Not Tested Yet

- Applying migrations to a live Supabase database.
- RLS behavior with real authenticated users.
- Supabase seed execution in a local database.
- Live server-side reads and writes.
- Driver QR token validation.
- Realtime Mission Control.

## Local Verification Checklist

1. Run `npm install`.
2. Run `npm run typecheck`.
3. Run `npm run lint`.
4. Run `NEXT_TELEMETRY_DISABLED=1 npm run build`.
5. Apply migrations in order to a local Supabase database.
6. Run `database/seed/0001_demo_kernel.sql`.
7. Verify demo project, mission, call sign, assignment, and timeline rows.
