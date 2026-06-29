# Supabase Local Setup

## Required Tools

- Node.js 20 or newer.
- npm.
- Supabase CLI.
- Docker Desktop for local Supabase.
- `psql` for directly applying SQL files when needed.

## Environment Variables

Application:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
DRIVER_ACCESS_TOKEN_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:7000
```

Local database:

```text
SUPABASE_DB_URL=
```

`SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` is optional for server-side local writes. Never expose service-role or secret keys in browser code, never prefix them with `NEXT_PUBLIC_`, and never import them into client components.

## Run Supabase Local

```bash
supabase start
supabase status
```

Confirm command availability with `supabase --help` because Supabase CLI behavior changes over time.

## Apply Kernel Migration

```bash
psql "$SUPABASE_DB_URL" -f database/migrations/0001_initial_kernel.sql
psql "$SUPABASE_DB_URL" -f database/migrations/0002_rls_foundation.sql
psql "$SUPABASE_DB_URL" -f database/migrations/0003_driver_assignment_foundation.sql
psql "$SUPABASE_DB_URL" -f database/migrations/0004_auth_rbac_foundation.sql
psql "$SUPABASE_DB_URL" -f database/migrations/0005_project_scoped_rls.sql
psql "$SUPABASE_DB_URL" -f database/migrations/0006_publish_change_baseline.sql
psql "$SUPABASE_DB_URL" -f database/migrations/0007_publish_locking_foundation.sql
psql "$SUPABASE_DB_URL" -f database/migrations/0008_driver_token_security.sql
psql "$SUPABASE_DB_URL" -f database/migrations/0009_storage_photo_foundation.sql
psql "$SUPABASE_DB_URL" -f database/migrations/0010_realtime_mission_control_foundation.sql
psql "$SUPABASE_DB_URL" -f database/migrations/0011_driver_live_location_pilot.sql
```

## Run Seed Data

```bash
psql "$SUPABASE_DB_URL" -f database/seed/0001_demo_kernel.sql
```

## Reset Local Database

If the local Supabase project is configured:

```bash
supabase db reset
```

If applying SQL manually, recreate the local database or reset through the Supabase CLI, then reapply migrations and seed in order.

## Verify Seed Data

```sql
select project_code, project_name from public.projects;
select mission_code, mission_name from public.missions;
select call_sign from public.call_signs;
select event_type from public.timeline_events order by created_at desc;
```

Expected demo project code: `TOMP-DEMO-001`.

## Run Writes Locally

1. Start Supabase locally.
2. Apply migrations through `0006_publish_change_baseline.sql`.
3. Run the demo seed.
4. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and optionally `SUPABASE_SECRET_KEY`.
5. Start the app with `npm run dev`.
6. Submit create forms from Projects, Missions, Assignments, Drivers, or Vehicles.

Verify inserted rows:

```sql
select id, project_code, project_name from public.projects order by created_at desc;
select event_type, object_type, reason from public.timeline_events order by created_at desc;
```

## Known Limitations

- RLS policies in `0002_rls_foundation.sql` are temporary development placeholders.
- Project-scoped RBAC is designed but not production-hardened yet.
- UI routes are placeholder-only and do not require database connectivity.
- Driver live location pilot exists through browser geolocation, server-side writes, `gps_locations`, and Mission Control map display. It is still not production fleet tracking.
- Driver QR access token validation is not implemented yet.
