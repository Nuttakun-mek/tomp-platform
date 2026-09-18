# 985 — Airport Transfer gets a project entity, and a future handoff to Ground Transfer

**Date:** 2026-09-18
**Status:** Part A (project entity) — design, ready for `writing-plans` once confirmed.
Part B (handoff) — deliberately deferred; recorded here so the decision is not
lost, not committed for now.
**Related:** `docs/11-codex/983` (Airport Transfer consistency audit),
`docs/11-codex/984` (central permission system — a different concern: *who*
can enter a system, not how that system organizes its own business data).

---

# Part A — a project entity for Airport Transfer, mirroring Ground Transfer

## Why

TOMP (renamed `ground-transfer` per `984`) can dispose of a whole engagement in
one action: `archiveProjectAction` flips a status flag, reversibly;
`delete_project()` cascades a permanent delete through every mission,
assignment, call sign, token, and GPS row underneath it. Airport Transfer has
no equivalent — confirmed by reading its schema: `airport_transfer_cases`
carries `organization_id` (always the same one row, `'TOMP Operations'`),
`external_tomp_project_id` (a real foreign key into `projects`, never
populated — zero of the 7 live cases use it), and a free-text `client_name`
(3 distinct values across 7 cases, half of them `null`). There is nothing to
archive or delete as a unit; a client engagement is not a first-class object
today, only a label some cases happen to share.

## What gets added

```sql
create table public.airport_transfer_projects (
  id uuid primary key default gen_random_uuid(),
  project_code text not null unique,        -- e.g. AT-20260918-XXXXXX, mirrors TOMP's shape
  project_name text not null,
  client_name text,
  start_date date,
  end_date date,
  status text not null default 'planning'
    check (status in ('planning', 'active', 'completed', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.airport_transfer_cases
  add column project_id uuid references public.airport_transfer_projects(id) on delete cascade;
```

Nothing else needs a new column. `airport_transfer_tasks`,
`_status_events`, `_flight_snapshots`, `_audit_logs` all already cascade from
`case_id → airport_transfer_cases.id`; once `cases.project_id` cascades from
the new table, deleting a project already reaches everything beneath it
transitively. (Confirm each of those four tables' `case_id` FK is genuinely
`ON DELETE CASCADE`, not `SET NULL`, before relying on this — worth a direct
check in the plan, not assumed here.)

Two lifecycle actions, mirroring TOMP's exactly because the ask was
"คล้ายกับ ground transfer":

- **Archive** — a status flip to `'archived'`, reversible, no data touched.
  Hides the project from the default list; nothing underneath it changes.
- **Delete** — permanent, cascades through cases → tasks/events/snapshots/logs.
  Should require the typed project-code confirmation TOMP's own delete flow
  uses, for the same reason: this is the one action in the product that
  cannot be undone.

## Existing live data — the one decision this needs from the owner

Seven real cases exist right now with no project, including flights scheduled
for tomorrow. `project_id` cannot go `NOT NULL` without first giving them one.
Recommendation: one legacy project (e.g. "เคสก่อนเริ่มใช้ระบบโครงการ") absorbs
all seven at migration time; nobody's guessing which of the three `client_name`
values should become "real" projects, since `null` on half the rows makes that
guess unreliable. Whoever runs Airport Transfer day to day can re-split them
into proper client projects by hand afterward, with better information than
a migration script has.

## Where this sits relative to `984`

Deliberately independent. `984` governs whether an account may open Airport
Transfer at all, and what role it holds there — flat, system-wide, unchanged
by this document. This document is Airport Transfer's own business-data
shape, parallel to how TOMP already organizes its own work into projects.
Airport Transfer's roles do **not** become project-scoped by this change —
if that is ever wanted (an `airport_dispatcher` who only sees one client's
project, for instance), it is a new, separate decision, not a side effect of
giving Airport Transfer a project table.

## URLs

Per `984`'s routing: `/airport-transfer/projects` (list),
`/airport-transfer/projects/[id]` (detail) — same shape as
`/ground-transfer/projects` will be after that cutover.

---

# Part B — future direction: handing a case off to Ground Transfer, not borrowing its plumbing

**Deferred. Nothing below is being built now.** Recorded because the
question — how would a driver actually get tracked on an airport pickup —
came up while designing Part A, and the answer reshapes what Airport
Transfer is for, so it should not be lost between now and whenever it is
picked up.

## The fact that forces the shape of any answer

Airport Transfer has no live-tracking capability of its own, and cannot grow
one independent of TOMP without duplicating a lot of already-solved work: a
GPS ping in this system can only attach to a TOMP `assignment_id` or
`call_sign_id` — that is what `gps_locations` is keyed on, with no other path
in. There is no way to get a real, moving position onto an Airport Transfer
case without a real TOMP assignment existing underneath it somewhere.

## What was proposed and corrected

The first framing considered here was "Airport Transfer *borrows* Ground
Transfer's tracking machinery" — i.e., quietly create a TOMP assignment as an
implementation detail, while Airport Transfer keeps owning the case
throughout. **Rejected, correctly:** that is not what should happen. The
right model is a genuine handoff — Airport Transfer's job is intake and
preparation (flight verification, passenger details, the pre-departure
checklist); at a deliberate moment, operational ownership of the actual
vehicle trip transfers to Ground Transfer outright, the same way a booking
system hands a confirmed order to a fulfilment system.

## The handoff, sketched

1. A case reaches a point someone decides it is ready to run — not automatic,
   a deliberate "ส่งงานต่อให้ Ground Transfer" action.
2. That action creates a real Ground Transfer call sign + assignment (using
   the case's driver, vehicle, pickup, dropoff, scheduled time), inside
   whichever Ground Transfer project is the right home for it — plausibly
   the Ground Transfer counterpart of whatever Airport Transfer project the
   case belongs to, once both systems have project entities.
3. The case's `operational_status` gains a value such as `handed_off`, and a
   new nullable column records which assignment it became.
4. **From that moment, Ground Transfer owns it completely.** The driver opens
   the same app, scans the same QR, shares GPS, sends messages — an ordinary
   Ground Transfer job with zero Airport-Transfer-specific code on that path.
   Airport Transfer's own edit screens stop being where changes happen —
   editing dispatch details after handoff belongs on the Ground Transfer
   side, so the two systems are never both convinced they hold the pen on
   the same facts at once.
5. A status bridge writes the assignment's key transitions back into
   `airport_transfer_status_events` — dispatched, arrived, completed — so an
   Airport Transfer case can close (and, eventually, be billed to a client
   like Chevron) without anyone opening Ground Transfer's own mission
   control to check.
6. The case detail page, once handed off, shows a link to Ground Transfer's
   own customer-facing tracking page rather than attempting its own map —
   there is exactly one live-tracking surface in the product, and Ground
   Transfer already owns it.

## Open questions for whenever this is picked up

- Is the handoff reversible — can a case be pulled back before a driver
  actually starts, or is it one-way once created?
- Does every Airport Transfer project get its own dedicated Ground Transfer
  project to hand off into, or do they all land in one shared operational
  project regardless of which client they came from?
- Does a Ground Transfer dispatcher need to see, at a glance, that a given
  job originated from an Airport Transfer booking — and if so, how much of
  the passenger/flight context travels with it, versus staying only in the
  Airport Transfer case for reference?

None of these need answering to ship Part A.
