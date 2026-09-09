# 959 — P0-4: atomic Timeline, execution note for the DB owner

Closes the last open **P0** from the 957 audit: a business write and its
immutable audit event are separate, so the database can hold a change with no
Timeline row. Migration `0025_timeline_write_triggers.sql` moves the Timeline
insert into the same transaction as the business write via `AFTER` triggers.

This is a two-step rollout because the app currently also writes those events;
during the gap the triggers' 20-second de-dup guard prevents double-logging.

## Step 0 — already verified on a throwaway database

`npm run db:verify-schema` (needs `SCHEMA_TEST_DATABASE_URL` pointing at a
disposable Postgres — see the script header) runs `0001 → latest` on a clean
database and asserts tables / RLS / constraints / role seeds. It was run during
`0025`/`0026` development and passes, including:

- `PROJECT_CREATED` / `MISSION_CREATED` / `ASSIGNMENT_CREATED` /
  `ASSIGNMENT_STATUS_CHANGED` / `ASSIGNMENT_CANCELLED` written by the triggers.
- **Forced-failure test**: a `BEFORE INSERT` trigger that raises on
  `timeline_events` makes the `projects` insert roll back with no leaked row.
- `create_project_command` → project + member; `publish_project_command` →
  snapshot + `projects.status='published'` + lock + `PROJECT_PUBLISHED`.

Two bugs were found and fixed this way before they could reach production:
`source='system_trigger'` violated `timeline_events_source_check` (now
`'system'`), and the `projects` table's project id is `id` not `project_id`
(the function now takes a 4th arg).

## Step 1 — apply on staging and re-verify with the app

```
SUPABASE_DB_URL=<staging> node scripts/apply-migrations.mjs --yes
```

Verify:

| Check | Expected |
|---|---|
| `insert into projects (...)` | exactly one `timeline_events` row, `event_type='PROJECT_CREATED'`, `source='system_trigger'`, `object_id` = the new project id |
| `insert into assignment_status_updates (...)` | one `ASSIGNMENT_STATUS_CHANGED`, `object_id` = `assignment_id` (not the update row's id) |
| `update assignments set status='cancelled'` | one `ASSIGNMENT_CANCELLED` with `before_data`/`after_data` |
| Break atomicity on purpose: `alter table timeline_events drop constraint timeline_events_project_id_fkey;` then insert a project with a bogus `project_id` | the **project insert fails** and rolls back (restore the constraint afterwards) |
| Run the app against staging, create a project through the UI | still exactly one `PROJECT_CREATED` (app write happens first, trigger's guard skips) |

## Step 2 — remove the now-redundant app-side Timeline calls

Once the triggers are on production, these `createTimelineEvent(...)` /
`create*TimelineEvent(...)` calls become duplicates and should be deleted (the
trigger is authoritative for these events):

| File | Call to remove |
|---|---|
| `app/actions/projects.ts` | `createProjectTimelineEvent(...)` in `createProjectAction` |
| `app/actions/missions.ts` | `createMissionTimelineEvent(...)` in `createMissionAction` |
| `app/actions/assignments.ts` | `createAssignmentTimelineEvent(...)` in `createAssignmentAction`; the `createTimelineEvent(ASSIGNMENT_CANCELLED)` in `cancelAssignmentAction` |
| `app/actions/driver.ts` | the `createTimelineEvent(...)` in `driverCheckinAction`, `assignmentStatusUpdateAction`, `driverIssueReportAction` |
| `app/actions/change-requests.ts` | the `createTimelineEvent(CHANGE_REQUEST_CREATED)` in the create path only |
| `app/actions/publish.ts` | the `createTimelineEvent(PROJECT_PUBLISHED)` |

Keep every other `createTimelineEvent` call — the triggers only cover the eight
events above. Not covered (stay app-side): change approve/apply/reject, driver
access token lifecycle, location sharing start/stop, `DIRECT_EDIT_BLOCKED`,
vehicle check-in.

After deleting the calls, the actions no longer need to treat Timeline as a
fallible separate step — drop the `warnings` plumbing that reported
`"...แต่บันทึก Timeline ไม่สำเร็จ"`.

## Step 3 — multi-row atomic commands (migration `0026`)

`0026_transactional_command_functions.sql` (apply after `0025`, staging first)
adds two `SECURITY DEFINER` functions that commit their whole command in one
transaction:

- `create_project_command(...)` — project row + creator `project_members` row
  (+ PROJECT_CREATED via the 0025 trigger).
- `publish_project_command(p_project_id, p_reason, p_snapshot, p_metadata)` —
  `publish_snapshots` + `projects.status` + `publish_locks` (+ PROJECT_PUBLISHED
  via the trigger). The app still computes readiness first (P0-5).

App change to deploy after `0026` is verified on staging:

| File | Change |
|---|---|
| `app/actions/projects.ts` | `createProjectAction` → `client.rpc("create_project_command", {...})`; delete `linkCreatorAsProjectManager` and `createProjectTimelineEvent`; map the returned row with `mapProject`. Handle `errcode 23505` message `project_code_taken` as the "รหัสโครงการนี้ถูกใช้งานแล้ว" failure. |
| `app/actions/publish.ts` | after the readiness check, `client.rpc("publish_project_command", { p_project_id, p_reason, p_snapshot: snapshot, p_metadata })`; delete the separate snapshot insert, `projects` update, `createPublishLock`, and `createTimelineEvent`. |

### Still open (its own follow-on)

- **change apply** — mutate the target row + `change_requests.status='applied'` +
  before/after, atomically. The target mutation is dynamic (assignment / mission
  / call sign), so this needs a per-object-type command function or a generic
  one that takes the target table + patch. Not yet written.
- **Idempotency keys** for retryable commands (a client-supplied
  `command_id` unique per command so a double-submit is a no-op).
