# database/migrations/

The single source of truth for the schema. `scripts/apply-migrations.mjs`
applies these to the cloud DB and tracks each by **exact filename** in
`public.schema_migrations_tomp`.

## Adding a migration

1. Name it `<NNNN>_<snake_case_summary>.sql` — `NNNN` = the next 4-digit number
   (e.g. `0030_...`). **Do not use a timestamp prefix.** Lexical sort = apply
   order, and a mix of `0030_` and `20260909_` names sorts unpredictably.
2. Make it idempotent where reasonable (`create table if not exists`,
   `create or replace function`, `drop policy if exists`) — it may be re-run on
   a fresh DB or after a rename.
3. Regenerate the Supabase CLI mirror and commit it:
   ```
   npm run db:local:sync
   git add database/migrations/ supabase/migrations/
   ```
4. Apply to the cloud: `node scripts/apply-migrations.mjs --yes`, then verify on
   a throwaway DB: `npm run db:verify-schema`.

## supabase/migrations/ is generated — never edit it by hand

It is a renumbered copy of this directory (the Supabase CLI keys on the numeric
prefix and rejects the intentional duplicates here). `npm run db:check-mirror`
(CI `verify` job) fails if it is stale — the usual cause is a merge that added
migrations on two branches without re-running `db:local:sync`. Fix:
`npm run db:local:sync` and commit.

## If an applied migration's file gets renamed

`apply-migrations.mjs` tracks by filename, so a rename makes it look unapplied.
Point the cloud tracking row at the new name (no SQL runs):

```
node scripts/apply-migrations.mjs --rename-applied <old.sql> <new.sql> --dry-run
node scripts/apply-migrations.mjs --rename-applied <old.sql> <new.sql>
```

## Checksum drift

If a file changes after it was applied, `apply-migrations.mjs` logs `CHANGED`
and will not re-run it. Confirm the live schema still matches with
`npm run db:check-drift`, then clear the flag with
`node scripts/apply-migrations.mjs --reconcile-checksums --yes`.
