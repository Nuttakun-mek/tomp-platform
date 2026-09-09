# 961 - P1-2: migration checksum drift, analysed and cleared

## Finding

`0011_driver_operations_rls`, `0018_seed_role_permissions`, `0019_rbac_rls_v2`,
and `0020_rbac_rls_v2_fixups` were edited in the repository after they had
already been applied to production. The recorded checksum in
`schema_migrations_tomp` therefore no longer matched the current files, and
`apply-migrations.mjs` previously logged `CHANGED ... not re-run` for each file.

This was migration bookkeeping drift, not confirmed schema drift.

## Drift Check

`scripts/check-migration-drift.mjs` verifies whether this matters by:

1. Applying `database/migrations/*.sql` to a disposable Postgres database.
2. Reading the RBAC surface from production in read-only mode:
   RLS policies, helper function definitions, and `role_permissions` rows.
3. Comparing the disposable expected schema with production.

Result:

```text
OK   RLS policies (35 rows match)
OK   role_permissions (39 rows match)
OK   can_read_project()
OK   current_org_id()
OK   current_profile_id()
OK   is_org_admin()
OK   is_project_member()
OK   is_super_admin()

NO DRIFT - production matches the repo history.
```

The later migrations already reconciled the live objects. The edits to the four
files were comments and idempotency guards, not behavioural changes. No
forward-repair migration was needed.

## Cleared In Production

Completed on 2026-09-10:

```powershell
node scripts/apply-migrations.mjs --reconcile-checksums --yes
node scripts/apply-migrations.mjs --dry-run
```

Final dry-run result:

```text
Nothing to apply. Database is up to date.
```

No `CHANGED` rows remain. The earlier note that the production write was blocked
by sandbox permissions is obsolete.

## Related Production Migration Hygiene

The production tracking row for the mobile-session migration was also renamed:

```powershell
node scripts/apply-migrations.mjs --rename-applied 20260909100835_driver_mobile_sessions.sql 0029_driver_mobile_sessions.sql
```

`0030_driver_mobile_sessions_grants.sql` was applied to production afterward.
That migration is an explicit service-role grant for `driver_mobile_sessions`;
it was safe and idempotent because production already had the effective
privilege through Supabase defaults.

## Re-checking Later

Use a disposable database, never production, for the expected-schema side:

```powershell
$env:SCHEMA_TEST_DATABASE_URL="postgresql://postgres:pw@127.0.0.1:55492/postgres"
node scripts/check-migration-drift.mjs
```

Exit code `0` means production still matches the repository migration history.
