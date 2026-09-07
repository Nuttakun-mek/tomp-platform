# Supabase Setup — Cloud and Local

There are two database tracks. Both apply the **same** SQL from `database/migrations/`.

| Track | When | Tooling |
| --- | --- | --- |
| **Cloud** (`nbvzqtxoxcghazrvbesx`) | shared dev / pilot / prod | `npm run db:migrate` (via `SUPABASE_DB_URL`) |
| **Local Docker** | offline / isolated dev | `npm run db:local:*` (Supabase CLI) |

`database/migrations/` is the single source of truth. `supabase/migrations/` is a
generated mirror for the CLI — `npm run db:local:sync` (run automatically by
`db:local:start` / `db:local:reset`) keeps it in step.

## Required tools

- Node.js 20+ and npm.
- Docker Desktop (for the local track).
- No global Supabase CLI needed — it is a dev dependency of `apps/web`; the
  `db:local:*` scripts call it through `npx --prefix apps/web supabase`.

## Cloud track

`SUPABASE_DB_URL` in `.env.local` is the Supabase pooler string. The runner
rewrites the transaction-pooler port `6543` to the session-pooler port `5432`
automatically because multi-statement DDL needs a session connection.

```bash
npm run db:migrate:dry     # connect, list pending migrations, apply nothing
npm run db:migrate         # apply pending migrations (prompts unless --yes)
npm run db:migrate -- --seed   # also load database/seed/*.sql (idempotent)
```

Applied migrations are tracked in `public.schema_migrations_tomp`. Each file runs
in its own transaction with its tracking row, so a failure rolls back cleanly.

## Local Docker track

The local stack runs on a **shifted port range** so it can coexist with other
local Supabase projects on the same machine:

| Service | Port |
| --- | --- |
| API / PostgREST | `54421` |
| Postgres | `54422` |
| Studio | `54423` |
| Inbucket (mail) | `54424` |

```bash
npm run db:local:start     # sync migrations, pull images, boot the stack
npm run db:local:reset     # re-sync, drop, re-run every migration + seeds
npm run db:local:status    # print URLs and keys
npm run db:local:stop      # stop containers (data is kept)
```

After `db:local:start`, point `.env.local` at the local stack. The keys below are
the Supabase CLI's fixed local-dev keys — identical on every install, not secret:

```text
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres
NEXT_PUBLIC_APP_URL=http://localhost:3000
DRIVER_ACCESS_TOKEN_SECRET=tomp-local-driver-token-secret
# not needed against local (REST works); keep only for the cloud track
# TOMP_ENABLE_POSTGRES_FALLBACK=1
```

Run `npm run db:local:status` to confirm (it also prints `sb_publishable_*` /
`sb_secret_*` variants if you prefer the new key format).

Studio: <http://127.0.0.1:54423>. Emails: <http://127.0.0.1:54424>.

`analytics`, `vector`, `imgproxy` and `pooler` are disabled for the local stack
(not needed for pilot testing, and analytics/logflare is flaky on Windows).

## Verify the schema

```sql
-- cloud track (applied by scripts/apply-migrations.mjs)
select filename from public.schema_migrations_tomp order by filename;

-- local Docker track (applied by the Supabase CLI)
select version, name from supabase_migrations.schema_migrations order by version;  -- 17 rows

-- both
select project_code, project_name from public.projects;
select mission_code, mission_name from public.missions;
```

## Live-test smoke

With the app running (`npm run dev`, port 3000) and a database reachable:

```bash
npm run live-test:smoke
```

Drives `/live-test` with headless Chrome: infra check → create
Project/Mission/Assignment → save `scripts/live-test-qr.png`, and prints a
LAN-host driver URL a phone on the same Wi-Fi can open.

## Known limitations

- RLS policies in `0002_rls_foundation.sql` are development placeholders.
- Project-scoped RBAC is designed, not production-hardened.
- Driver live location is browser geolocation + server-side writes, not
  production fleet tracking.
- `alter publication supabase_realtime …` in `0010`/`0011` needs the Supabase
  `supabase_realtime` publication — present on both tracks, absent on a bare
  Postgres container.
