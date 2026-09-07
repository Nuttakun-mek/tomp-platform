# Pilot Stability Follow-up — Handoff

**Date:** 2026-09-07
**Branch:** `fix/pilot-stability-followup` (3 commits, **not pushed**, base `main` @ `9cfb896` → merged the local commit `958d226`)
**Status:** all requested work done and verified locally; physical-phone GPS test + branch push left to the humans.

This note lets another agent pick up, verify, or split the remaining work.

---

## 1. What was asked

1. Review the diff of `958d226` ("fix: stabilize pilot map and live test flow"). → done, 9 findings.
2. Fix the review findings + build migration tooling.
3. Make the Supabase table check pass in `/live-test`.
4. Apply all `database/migrations/` to the real Supabase project.
5. Run `/live-test` → create Project → Mission → Assignment → real QR.
6. Open the QR on a phone, share GPS, confirm the marker shows in Mission Control.
7. Stand up a local Supabase (Docker) as a separate track.

---

## 2. Commits on the branch

| SHA | Title | Contents |
| --- | --- | --- |
| `aae50cd` | fix: harden pilot data fallbacks and add migration runner | 10 review fixes; `scripts/apply-migrations.mjs`; `0011_driver_operations_rls.sql` bug fix |
| `2055af1` | chore: add live-test E2E smoke script and dev LAN origin | `scripts/live-test-smoke.mjs` (puppeteer-core); `next.config` `allowedDevOrigins`; infra check timeout bump |
| `3e96a0c` | chore: add local Supabase (Docker) track | `supabase/` (config + 17 renumbered migrations); `scripts/sync-supabase-migrations.mjs`; `db:local:*` npm scripts; rewrote `docs/10-deployment/1001-supabase-local-setup.md` |

`npm run typecheck && npm run lint && npm test` → all green (30 tests). No new tests were added for the data-layer fallback changes — the repo has no data-layer test harness (only pure domain/auth tests). **Open task.**

---

## 3. Review findings and how each was resolved

Source review: `958d226`. Findings in `aae50cd`.

| # | File | Finding | Fix |
| --- | --- | --- | --- |
| 1 | `lib/supabase/server.ts` | 2000ms fetch timeout → demo data served silently on mild latency | → 8000ms (both read clients) |
| 2 | `lib/data/locations.ts` | timeout → `getLatestDriverLocationsViaPostgres` → demo rows, no error surfaced | renamed to `getLatestDriverLocationsFallback(…, {allowDemo})`; runtime failure with no Postgres → **throws**; `!data?.length` returns `[]` (not demo); per-query timeout 2200→6000ms |
| 3 | `components/mission-control/live-location-map.tsx` | `setLocations(result.data ?? [])` wiped markers on any failed poll | only `setLocations` when `result.success !== false && Array.isArray(result.data)` |
| 4 | `app/api/admin/pilot-infrastructure/route.ts` | `requiredTables` 12 vs smoke action's 18 | new `lib/db/pilot-tables.ts` `PILOT_REQUIRED_TABLES`; imported in route, `lib/db/pilot-scenario.ts`, `app/actions/pilot-smoke-test.ts` |
| 5 | `lib/data/locations.ts` | timeout → `{success:true,data:[]}`, no `lastError` | route already returns `success:false` on throw; data layer now throws (see #2) |
| 6 | `app/api/admin/pilot-infrastructure/route.ts` | always HTTP 200; dead fallback branch; smoke script green on broken infra | route refactored; kept HTTP 200 (route ran) but `scripts/production-smoke.mjs` now asserts `json.ready === true` for that route |
| 7 | `components/live-test/live-gps-test-panel.tsx` | `withClientTimeout` duplicated `lib/async/timeout` | deleted; `withTimeout` gained optional `timeoutMessage` arg; panel passes Thai messages |
| 8 | `lib/db/pilot-scenario.ts` | import order | fixed; also collapsed the local `requiredTables` into the shared const |
| 9 | `lib/supabase/fetch-timeout.ts` | abort listener leak | **already fixed** in committed code (`{ once: true }`) — no change |
| + | `lib/env.ts` | `fs`/`path` could reach a client bundle | added `import "server-only"` |
| + | `app/actions/pilot-smoke-test.ts` | infra check per-table timeout 2500ms tripped all 18 on cold start | → 6000ms (`2055af1`) |

---

## 4. The Supabase project — important facts

- Project `nbvzqtxoxcghazrvbesx` ("TOMP", ap-northeast-1) is **`ACTIVE_HEALTHY`**. An earlier claim in this thread that it was deleted was **wrong** — caused by this machine transiently failing to resolve `*.supabase.co` (Cloudflare WARP / DNS cache; WARP was later found disconnected and resolution recovered).
- `.env.local` `SUPABASE_DB_URL` is the **transaction pooler** (`…pooler.supabase.com:6543`). Correct for the serverless app. `scripts/apply-migrations.mjs` rewrites `:6543` → `:5432` (session pooler) because multi-statement DDL needs a session connection.
- Direct host `db.<ref>.supabase.co` does not resolve over IPv4 (Supabase is IPv4-deprecated for direct). Use a pooler.
- Migration tracking table on cloud: `public.schema_migrations_tomp` (columns `filename`, `applied_at`, and now `checksum` — added by the runner; the pre-existing 10 rows have null checksums, which the runner tolerates).

### Migration state that was found (and why it was messy)

`schema_migrations_tomp` had 10 rows (`0001`–`0010`, specific filenames) but the DB schema was actually **further along** — someone had applied `0011`/`0012`-equivalent SQL out of band without recording it (RLS on, `service role manages …` policies present, `gps_locations` already had `speed/heading/altitude/sharing_event`). The 7 "pending" migrations were therefore all no-ops / additive **after** one real fix:

- `database/migrations/0011_driver_operations_rls.sql` referenced `p.user_id` (column is `p.auth_user_id`) and used bare `create policy` (fails if policy exists). Rewritten to `p.auth_user_id` + `drop policy if exists` before every `create policy`. **This file is edited in place** — acceptable because it had never applied cleanly.

All 7 were then applied with `node scripts/apply-migrations.mjs --yes`. `db:migrate:dry` now reports "up to date" (17 tracked).

---

## 5. Verified working (evidence)

| Check | Result |
| --- | --- |
| `GET /api/admin/pilot-infrastructure` | `ready: true`, **18/18 tables ok**, `mode: service_role` |
| `/live-test` full flow (via `npm run live-test:smoke`) | created Project `PILOT-202609070759` (`69d0a04e-73df-4235-b3c7-903d6a7d1020`), Mission `MIS-202609070759`, Assignment `80e5543f-6978-4b7d-b4dd-6352ab095e68`, Call sign `PILOT-0759`, Driver `317510f9-e516-4193-8820-3145e737ef3d`, active token — every row confirmed via REST |
| GPS ingestion | 5 pings POSTed to `/api/driver/location` with the pilot token (Bangkok coords) — inserted OK |
| `GET /api/mission-control/locations?projectId=69d0a04e…` | `success:true`, 1 marker, enriched `callSign=PILOT-0759`, `driverName`, `projectName` |
| Mission Control page render | marker on map, Timeline shows `DRIVER_LOCATION_SHARING_STARTED` + `DRIVER_ACCESS_TOKEN_CREATED` |
| Local Docker: `npm run db:local:start` | 17 migrations + 2 seed files applied clean; REST at `http://127.0.0.1:54421` serves the 2 seeded projects |

Pilot access token (expires **2026-09-08 08:00 UTC**):
```
tomp_80e5543f-6978-4b7d-b4dd-6352ab095e68_317510f9-e516-4193-8820-3145e737ef3d_kgLluiIx1HMGLWhV2HpTtXm9vp5d3NtMSneB3QxMgLo
```
Phone URL (same Wi-Fi as the dev machine): `http://172.20.10.3:3000/driver?token=<above>`

---

## 6. Local Docker track — specifics

- `supabase` + `puppeteer-core` are devDeps of `apps/web`. `db:local:*` and `live-test:smoke` scripts call them via `npx --prefix apps/web`.
- Ports **shifted +100** (`54421` API / `54422` DB / `54423` Studio / `54424` mail) so the stack coexists with another local Supabase project (`event-carbon-dashboard`) already bound to the defaults.
- `analytics` / `vector` / `imgproxy` / `pooler` disabled in `supabase/config.toml`.
- `supabase/migrations/` is a **generated mirror** of `database/migrations/`, **renumbered** to strict sequential prefixes (`0001`–`0017`) because the source dir reuses `0007/0009/0010/0011` and the CLI's `supabase_migrations.schema_migrations` PK is the numeric prefix. `scripts/sync-supabase-migrations.mjs` (run automatically by `db:local:start` / `db:local:reset`) keeps it current — **do not hand-edit `supabase/migrations/`**.
- Local demo keys are the CLI's fixed values (documented in `docs/10-deployment/1001-supabase-local-setup.md`), not secret.

---

## 7. Open / pending work

| Priority | Task | Notes |
| --- | --- | --- |
| — | **Physical phone GPS test** (item 6) | humans only. Open the phone URL above, share GPS, watch Mission Control. Realtime WS push was not verified (only the 7s polling path was) — confirm on a real device. |
| high | **Push branch / open PR** | not pushed. `git push -u origin fix/pilot-stability-followup`. |
| med | **Data-layer tests** | no coverage for the new `getLatestDriverLocationsFallback` throw path, `getProjectByIdViaPostgres` null return, or the map "keep markers on failed poll" behavior. Repo has no mocking harness for `getSupabaseServerDataClient` / `getPostgresClient` — needs one. |
| med | **`next.config.ts` `allowedDevOrigins`** | hardcodes `172.20.10.3`. Make it read from an env var or drop it if LAN phone testing moves to a tunnel. |
| low | **Cloud test-data cleanup** | 5 `PILOT-*` projects with `metadata->>smokeTest = 'true'` in cloud (4 pre-existing, 1 from this session: `PILOT-202609070759`). Safe to delete by that metadata filter. |
| low | **`.env.local`** | this session added `TOMP_ENABLE_POSTGRES_FALLBACK=1` (belt-and-suspenders; REST works now). Harmless. Remove if you want local == prod behavior. |
| low | **Rotate the Supabase PAT** | a `sbp_…` personal access token was pasted into the chat during this session. Rotate at supabase.com/dashboard/account/tokens. |
| low | **`schema_migrations_tomp` backfill** | the first 10 cloud rows have null `checksum`. Cosmetic; runner handles it. |

---

## 8. Running services left up (this session)

- `npm run dev` on **port 3000** (background). `next dev` default port — note `.env.local` says `NEXT_PUBLIC_APP_URL=http://localhost:7000` but the script has no `-p`, so it's 3000.
- Local Supabase: 10 `supabase_*_tomp-platform` containers. Stop with `npm run db:local:stop`.

---

## 9. How to re-verify from scratch

```bash
# cloud track
npm run db:migrate:dry            # expect "up to date"
curl -s localhost:3000/api/admin/pilot-infrastructure | jq '.ready, (.tables|map(select(.ok|not)))'

# live-test flow
npm run dev                       # port 3000
npm run live-test:smoke           # creates a fresh scenario, saves scripts/live-test-qr.png

# local docker track
npm run db:local:reset            # re-applies 17 migrations + seeds
npm run db:local:status
```

Key source files to read first: `lib/data/locations.ts`, `lib/db/pilot-tables.ts`,
`app/actions/pilot-smoke-test.ts`, `scripts/apply-migrations.mjs`,
`scripts/sync-supabase-migrations.mjs`, `docs/10-deployment/1001-supabase-local-setup.md`.
