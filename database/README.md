# Database

This directory contains the Supabase/PostgreSQL foundation for the TOMP kernel.

## Files

- `migrations/0001_initial_kernel.sql`: Sprint 1 kernel schema.
- `seed/0001_demo_kernel.sql`: demo seed data for local review.
- `policies/0001_kernel_rls_todos.md`: RLS policy concepts to implement before live data access.

## Required Environment Variables

Application runtime:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Local database tooling:

```text
SUPABASE_DB_URL=
```

`SUPABASE_DB_URL` should be a local or remote Postgres connection string. Do not expose service-role keys to browser code.

## Apply the Migration

Preferred local Supabase CLI flow:

```bash
supabase start
psql "$SUPABASE_DB_URL" -f database/migrations/0001_initial_kernel.sql
```

If your Supabase CLI project is configured for migrations, you can also copy the SQL into the Supabase migration workflow and apply it with your local database reset flow:

```bash
supabase db reset
```

Use `supabase --help` on your machine to confirm exact command availability because Supabase CLI commands change over time.

## Run Seed Data

After applying `0001_initial_kernel.sql`, load the demo kernel data:

```bash
psql "$SUPABASE_DB_URL" -f database/seed/0001_demo_kernel.sql
```

The seed inserts one demo organization, profile placeholder, project, operation day, session, mission, call sign, vehicle, driver, assignment, assignment version, and timeline event.

## RLS Note

The initial migration enables RLS on kernel tables, but intentionally does not ship production RBAC policies yet. See `database/policies/0001_kernel_rls_todos.md` before connecting live UI reads or writes.
