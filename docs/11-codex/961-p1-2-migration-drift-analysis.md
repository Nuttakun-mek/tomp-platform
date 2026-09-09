# 961 — P1-2: migration checksum drift, analysed and cleared

## The finding

`0011_driver_operations_rls`, `0018_seed_role_permissions`, `0019_rbac_rls_v2`
and `0020_rbac_rls_v2_fixups` were edited in the repo **after** being applied to
production — the recorded checksum in `schema_migrations_tomp` no longer matches
the file, so `apply-migrations.mjs` logs `CHANGED … not re-run` for each.

`scripts/check-migration-drift.mjs` (new) settles whether that matters. It:

1. applies `database/migrations/*.sql` (`0001 → 0027`) to a disposable Postgres
   — the schema the current repo history produces;
2. reads the RBAC surface from **production** (read-only, `pg_catalog` only):
   RLS policies (name / cmd / USING / WITH CHECK), the `SECURITY DEFINER` helper
   functions (`pg_get_functiondef`), and every `role_permissions` row;
3. diffs the two.

Result (2026-09-09):

```
  OK   RLS policies (35 rows match)
  OK   role_permissions (39 rows match)
  OK   can_read_project()  current_org_id()  current_profile_id()
  OK   is_org_admin()  is_project_member()  is_super_admin()

NO DRIFT — production matches the repo history.
```

The later migrations (`0018 → 0027`, all `create or replace` / `drop policy if
exists`) already reconciled the live objects. The edits to the four files were
comments and idempotency guards, not behaviour. **No forward-repair migration is
needed.**

## Clearing the warning

`scripts/apply-migrations.mjs --reconcile-checksums --yes` re-records the current
file hash for any already-applied migration whose file changed — it runs no SQL
beyond `update public.schema_migrations_tomp set checksum = …`. Run it once
against production to silence the `CHANGED` lines:

```
node scripts/apply-migrations.mjs --reconcile-checksums --yes
node scripts/apply-migrations.mjs --dry-run   # expect: "Nothing to apply", no CHANGED
```

> Status: the reconcile write to production is still pending — the sandbox
> classifier blocked the run. The analysis above stands regardless; the
> reconcile is cosmetic (checksum bookkeeping only).

## Re-checking later

`SCHEMA_TEST_DATABASE_URL=postgres://… node scripts/check-migration-drift.mjs`
(needs a disposable Postgres and `SUPABASE_DB_URL` in `.env.local`). Exit 0 =
production matches the repo. Run it after any future manual DB change.
