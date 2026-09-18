# 983 — Airport Transfer: consistency audit, and what to check before touching it

**Date:** 2026-09-18
**Status:** audit only — nothing in this document has been applied. Read this before
you write a migration, grant a role, or run `apply-migrations.mjs` near this module.
**Why this exists:** the previous session (mine) reported Airport Transfer as
unauthorized/missing code, based on a stale local `git fetch`. It is not missing —
it is real, in this repo, on `main`, live in production, and actively being built by
a parallel session. That false alarm is exactly the class of mistake this document
exists to prevent happening again, from either side.

---

# 0. What Airport Transfer actually is (for an agent seeing it cold)

A second business module living inside this same repo and this same Supabase
project, reachable at `/airport-transfer`. It coordinates flight pickups/drop-offs
for clients (e.g. "Chevron") separately from TOMP's project/mission/assignment
model — a "case" here is one passenger's transfer, not a TOMP assignment.

- **Pages:** `apps/web/app/airport-transfer/**` (list, case detail, edit, imports,
  settings, trash)
- **Components:** `apps/web/components/airport-transfer/**`
- **Domain logic:** `apps/web/lib/airport-transfer/**` (`types.ts`, `data.ts`,
  `access.ts`, `flight-provider.ts`, `flight-sync.ts`)
- **Cron:** `apps/web/app/api/cron/airport-transfer-flights/route.ts`, registered in
  `apps/web/vercel.json`, running daily, calling the AirLabs flight-status API
- **Schema:** 9 tables, prefix `airport_transfer_*` — cases, tasks, status events,
  flight snapshots, audit logs, memberships, import batches/rows, api health
- **Env needed:** `AIRLABS_API_KEY`, `AIRPORT_TRANSFER_SYNC_SECRET` (added to
  `.env.example`; not verified here whether they are set in Vercel — check before
  assuming the cron works)

Confirmed live in production via response headers (`X-Matched-Path:
/airport-transfer` on a real page, vs `/_not-found` on a route that doesn't exist)
and via the database (7 real cases, 74 tasks, flight polling actually running).

---

# 1. False alarms from last session — retracted here

- **`vercel.json` did not lose its rewrites.** Diffing `f0f236a` (before the pull)
  against the merged tip shows the Airport Transfer commits only *added* a `crons`
  block. Nothing was removed. (There was never a `rewrites` block in this file to
  begin with — the `/projects/[id]` → `/project` pretty-URL logic lives in a
  server-side `redirect()` in the page itself, not in `vercel.json`.)
- **No TypeScript name collisions.** Every exported type/function in
  `lib/airport-transfer/**` is prefixed `AirportTransfer*` and none of it shadows
  anything in `@tomp/types/schemas.ts` (`Driver`, `Vehicle`, `Project`, `Mission`,
  `Assignment`, `CallSign`).
- **Foreign keys ARE enforced correctly.** `airport_transfer_cases.driver_id`,
  `.vehicle_id`, `.organization_id`, `.external_tomp_project_id`, and the three
  `profiles`-referencing audit columns all carry real `ON DELETE SET NULL`
  constraints, matching the rest of this schema's house style. A vehicle or driver
  deleted in TOMP will not leave a case pointing at a ghost id.
- **`lib/airport-transfer/data.ts` does not duplicate resource-fetching code.** It
  only imports its own Supabase client, its own types, and the flight provider —
  it never re-implements `getDrivers`/`getVehicles` from `lib/data/resources.ts`.

---

# 2. Real inconsistencies found — each needs a deliberate decision, not a silent fix

## 2.1 A migration exists that this repo's own tooling cannot see

`supabase/migrations/20260918071051_enforce_airport_transfer_task_sequence.sql`
adds a trigger (`enforce_airport_transfer_task_sequence_trigger`) that blocks
completing a task out of order. **It has never been applied** — the only live
trigger on `airport_transfer_tasks` right now is the generic `set_updated_at`
one. Verified directly against the database, not inferred.

The problem is not just that it's unapplied — it's that `scripts/apply-migrations.mjs`
**only ever reads `database/migrations/*.sql`**. This file uses Supabase CLI's
native `YYYYMMDDHHMMSS_name.sql` naming and has no numbered twin there, so it is
structurally invisible to the tool this project uses to answer "is anything
pending?" Running `--dry-run` and seeing only `0042` pending (see 2.2) is not
proof everything else is applied — it's proof only of what that one directory
holds. **Check both `database/migrations/` and `supabase/migrations/` by hand
until this is resolved**, because five commits titled "Enforce sequential Airport
Transfer workflow" (`db405ef`, `bf85f01`, `e55712f`, `ff9e04e`, `c7547b8`) suggest
someone is actively relying on this constraint existing.

Recommended, not done: give it a numbered twin (next free number is `0043`) in
`database/migrations/` with the same SQL, so it enters the tracked system. Left
for whoever owns this module's migration history, since claiming `0043` right now
could collide with work already in flight in the other session.

## 2.2 One migration's ledger entry is missing, though its effect already happened

`database/migrations/0042_airport_transfer_airlabs_provider.sql` shows as
**pending** in `apply-migrations.mjs --dry-run`. But the switch it performs —
retiring the `aerodatabox` provider row in favour of `airlabs` — is already live
in `airport_transfer_api_health` (`metadata.previous_provider: 'aerodatabox'`,
`migrated_at: '2026-09-18T01:14:40'`). Someone ran the equivalent SQL directly
against production and the file was written down afterward to describe it,
without ever recording it in `schema_migrations_tomp`.

The file is idempotent (`on conflict do nothing`, `where provider = 'aerodatabox'`
which currently matches zero rows) — running it now would be a safe no-op. Not
run here; flagging for a deliberate call instead of quietly closing the gap
myself while another session may still be mid-change in this exact area.

## 2.3 Two already-applied migrations no longer match their checksum

`0040_airport_transfer_foundation.sql` and `0041_airport_transfer_lifecycle.sql`
both show `CHANGED` — the file content now differs from what was hashed when
`schema_migrations_tomp` recorded them as applied. `apply-migrations.mjs` treats
this as "don't touch," which is the safe default, but it means **the file in git
does not necessarily describe what is live in the database for these two.** If
you need to know the exact DDL that actually ran, the file is not a reliable
source for these two filenames specifically — check the live schema instead.

## 2.4 A pre-existing numbering offset between the two migration directories — not caused by Airport Transfer, but worth knowing before adding more files

`database/migrations/0007` through `0013` and `supabase/migrations/0008` through
`0017` describe the same six migrations (`rbac_hardening`,
`driver_token_security`, `storage_foundation`, ...) one number apart. This predates
Airport Transfer — `database/migrations/` has two files both claiming `0009`
(`0009_storage_foundation.sql` and `0009_storage_photo_foundation.sql`), which is
almost certainly *why* the mirror drifted. **Do not renumber these** — they are
long since applied, and touching an applied file's name changes its checksum.
This is a documented historical quirk, not a bug to retroactively fix. It does
mean: when picking the next migration number, check the actual filenames in
`database/migrations/` (not the supabase mirror, and not `schema_migrations_tomp`
alone) — as of this audit the next free number there is `0043`.

## 2.5 Airport Transfer's roles are a second, unconnected authorization system

`airport_transfer_memberships.role_key` is a bare `text` column holding
`airport_admin | airport_dispatcher | airport_coordinator | airport_driver |
airport_viewer`. None of these five keys exist as rows in `public.roles`
(confirmed — the table holds exactly TOMP's 11 role keys, no `airport_*` among
them). Consequences, all verified:

- `roleHasPermission()` / `ROLE_PERMISSIONS` in `lib/auth/permissions.ts` has
  never heard of these roles and cannot grant or check them.
- `lib/i18n/role-th.ts` has no Thai label for any of the five — anywhere this
  role shows up in a UI, it would show the raw English key.
- **There is no admin page anywhere that manages `airport_transfer_memberships`.**
  Grepped the whole app tree; nothing references that table outside
  `lib/airport-transfer/access.ts` itself.
- The table currently has **zero rows.** Access right now works only because
  `getAirportTransferAccess()` gives `super_admin` a bypass — which is also why
  this module is not broadly exposed today (see the RLS note in the prior
  session's findings). But it also means **there is currently no way to onboard
  a real dispatcher.** Someone would have to `insert` a membership row by hand.

This is a real fork in the road, not a bug to patch: either (a) fold Airport
Transfer's roles into the main `roles`/`role_permissions` tables so one admin
surface governs both modules, or (b) keep it deliberately separate — a
reasonable choice if this module is meant to have its own operator population —
but then it needs its own admin UI and its own i18n labels before anyone besides
`super_admin` can use it. Left undecided here on purpose.

## 2.6 Two different ideas both called "vehicle type"

`airport_transfer_cases.vehicleType` is a controlled dropdown — `sedan |
executive_sedan | van | luxury_van`, Thai-labelled in
`create-case-form.tsx:230` — describing **what the client asked for**.
`vehicles.vehicle_type` (TOMP's own resource table) is free text with no
controlled vocabulary at all — real production values include `Van`, `van`, and
test junk like `ตู้วววว`. These are two different concepts wearing the same
name, and **nothing checks them against each other**: a case can have
`vehicleType = "luxury_van"` and a linked `vehicle_id` whose actual
`vehicle_type` says something completely different, with no validation either
way. Not a crash risk — a reporting/trust risk if anyone ever assumes the two
fields agree.

---

# 3. What I did — and, more importantly, did not — touch

Wrote only this document. No migration was run, no role was granted, no code in
`apps/web/app/airport-transfer/**`, `apps/web/components/airport-transfer/**`, or
`apps/web/lib/airport-transfer/**` was changed, and nothing in `database/migrations/`
or `supabase/migrations/` was added, renamed, or edited.

Every fix implied above is a real design decision for whoever owns this module
next — very possibly still mid-iteration in a different session, given the
repeated same-titled commits found in `git log`. Applying any of them
unilaterally from a second, uncoordinated session is exactly the kind of
collision this document exists to prevent.

---

# 4. For the next agent — read this before you do anything near Airport Transfer

- **`git fetch --all` before you trust any comparison against `origin/main`.**
  The false alarm that started this audit happened because a stale local view of
  `origin/main` made 30 real, pushed commits look like they didn't exist anywhere.
  Fetch first, always, on this repo specifically — more than one workspace pushes
  to `main` here.
- **`apply-migrations.mjs --dry-run` only tells you about `database/migrations/`.**
  It is blind to `supabase/migrations/*.sql` files using timestamp naming (like
  `20260918071051_...`). Check both directories by hand when you need to know
  what's really pending.
- **Airport Transfer roles are not TOMP roles.** If someone asks "who can see
  Chevron's case," the answer is not in `/superadmin/users` — it's a direct query
  against `airport_transfer_memberships`, which currently has no admin UI at all.
- **Do not renumber `database/migrations/0007`–`0013`.** The offset against the
  `supabase/migrations/` mirror is old, known, and cosmetic. Renumbering an
  already-applied file only breaks its checksum for no benefit.
- **Next free migration number, as of this audit, is `0043`.**
- Full outstanding-work index is still `docs/11-codex/982-remaining-work.md`;
  this document is additive to it, specifically for the module that arrived
  after 982 was written.
