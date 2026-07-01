# Production Pilot Smoke Test

## Objective

Verify that TOMP can run the core pilot flow on production:

Project → Mission → Assignment → QR → Driver page → GPS sharing → Mission Control.

## Production Tool

Open:

`/admin/pilot-smoke-test`

## Steps

1. Click **ตรวจ Supabase และตาราง**.
2. Confirm all required tables pass.
3. Click **สร้างชุดทดสอบจริง**.
4. Open the driver link on a mobile browser.
5. Start GPS sharing and grant location permission.
6. Open Mission Control from the generated link.
7. Confirm the latest driver location appears.
8. Confirm driver operations panel shows packet/session status.

## Required Migrations

- `0010_driver_operations_foundation.sql`
- `0011_driver_operations_rls.sql`
- `0012_driver_operations_explicit_grants.sql`

## Pass Criteria

- Supabase connection works.
- Driver operation tables are reachable through server-side Supabase client.
- Scenario is created with unique IDs.
- QR opens a valid driver page.
- GPS ping writes to `gps_locations`.
- Location session writes to `driver_location_sessions`.
- Mission Control loads for the generated project.

## Known Limitations

- Web GPS requires the browser page to remain active.
- Background GPS needs future Mobile Driver App.
- Auth/RBAC is not yet final enterprise production hardening.
