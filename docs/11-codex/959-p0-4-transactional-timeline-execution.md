# 959 — P0-4: atomic Timeline, execution note for the DB owner

Closes the last open **P0** from the 957 audit: a business write and its
immutable audit event are separate, so the database can hold a change with no
Timeline row. Migration `0025_timeline_write_triggers.sql` moves the Timeline
insert into the same transaction as the business write via `AFTER` triggers.

This is a two-step rollout because the app currently also writes those events;
during the gap the triggers' 20-second de-dup guard prevents double-logging.

## Step 1 — apply and verify on a disposable / staging database

```
TEST_DATABASE_URL=... node scripts/apply-migrations.mjs --yes   # to staging only
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

## Step 3 — the remaining transactional-kernel work (still Batch B)

The triggers guarantee "a change always has an audit event". They do **not**
cover multi-row commands that must be all-or-nothing across several tables:

- project create + `project_members` + owner link (three writes)
- publish: snapshot + `projects.status` + `publish_locks` (three writes)
- change apply: mutate target + `change_requests.status` + before/after

Those still need real RPC command functions (`security definer`, one
transaction, validate ownership → mutate → return one result) plus idempotency
keys for retried commands. Scope that as its own migration + plan; it is
independent of and can follow 0025.
