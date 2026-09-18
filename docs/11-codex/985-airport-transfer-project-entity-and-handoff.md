# 985 — One shared project, scoped per system, and a future handoff to Ground Transfer

**Date:** 2026-09-18
**Status:** Part A — design, revised once from its first pass (see "What changed"
below), ready for `writing-plans` once the one open question (audit log /
import row retention) is answered.
Part B (handoff) — deliberately deferred; recorded so the decision is not
lost, not committed for now.
**Related:** `docs/11-codex/983` (Airport Transfer consistency audit),
`docs/11-codex/984` (central permission system — a different concern: *who*
can enter a system, not how a project organizes which systems it uses).

## What changed from the first pass of this document

The first pass gave Airport Transfer its own `airport_transfer_projects`
table, parallel to but separate from TOMP's `projects`. Revised in
conversation: a client engagement is one real-world thing, and having it live
as two separate rows in two separate tables meant "the project ended, delete
it" would have to happen twice — once per system — for one engagement that
only ended once. The model below uses **one shared project** instead, with a
new table saying which system(s) that project uses. Nothing about `984`'s
URL split or account-level access changes because of this — see "Where this
sits relative to `984`" below.

---

# Part A — one project, scoped to whichever systems it uses

## Why

TOMP's `projects` table already does everything a "client engagement" needs
— code, name, date range, status, and `archiveProjectAction`
(reversible status flip) / `delete_project()` (permanent cascade) to close
one out. Airport Transfer has never had an equivalent: `airport_transfer_cases`
carries `organization_id` (always the same one row, `'TOMP Operations'`),
`external_tomp_project_id` (a real foreign key into `projects` that has never
once been populated — zero of the 7 live cases use it), and free-text
`client_name` (3 distinct values across those 7 cases, half of them `null`).
Rather than build a second version of what `projects` already is, this reuses
it directly.

## What gets added

```sql
-- Which systems a project uses. One row per system it has opted into;
-- extensible to a third system later with no schema change, matching the
-- `systems` registry `984` already defines.
create table public.project_systems (
  project_id uuid not null references public.projects(id) on delete cascade,
  system_key text not null references public.systems(key),
  enabled_at timestamptz not null default now(),
  enabled_by uuid references public.profiles(id) on delete set null,
  primary key (project_id, system_key)
);

alter table public.airport_transfer_cases
  add column project_id uuid references public.projects(id) on delete cascade;
-- external_tomp_project_id is superseded by this column once every case
-- is migrated onto it — drop it in the same migration, not left dangling.
```

`airport_transfer_tasks`, `_status_events`, `_flight_snapshots` all already
cascade from `case_id → airport_transfer_cases.id` with `ON DELETE CASCADE`
— confirmed directly against the live schema, not assumed. Once `cases`
cascades from `projects`, `delete_project()` reaches all three **with zero
changes to that function** — it already just does
`delete from public.projects where id = target_project` as its last step and
lets Postgres's own cascade graph do the rest; it does not need to know
Airport Transfer exists.

## The one real gap this surfaced, and needs a decision

Two tables under a case are **not** `ON DELETE CASCADE` — checked directly,
not assumed:

- `airport_transfer_audit_logs.case_id` → `ON DELETE SET NULL`
- `airport_transfer_import_rows.imported_case_id` → `ON DELETE SET NULL`

Deleting a project today would leave both tables' rows behind, orphaned
(`case_id`/`imported_case_id` set to null), rather than removed. This may be
deliberate — audit trails often ought to outlive the record they describe —
or it may not be what "delete this project" should mean if the point is to
actually clear out a client's data, including whatever passenger names and
phone numbers live inside `audit_logs.old_value`/`new_value`. **Needs an
answer before this ships, not a guess:** either accept the orphaned rows as
intentional audit permanence, or change both FKs to `ON DELETE CASCADE` (a
small, separate migration) so a delete is a real delete.

## Project creation — the one new step, everywhere else unchanged

Confirmed against the live form (`create-project-form.tsx`): today it asks
for project code, name, date range, timezone, and service level, with a
TOMP-specific description ("รวมภารกิจ งานที่จัดสรร คนขับ รถ QR, GPS และ
Timeline") that would need to generalize, since this same form can now
produce an Airport-Transfer-only project.

The sequence: **login → land on a system (`984`) → press "สร้างโครงการ" as
today → one new required section, "ระบบที่จะใช้ในโครงการนี้"** — a checkbox
per row in `984`'s `systems` registry, the system you arrived from
pre-checked, any others optional. Submit writes the `projects` row exactly as
today, plus one `project_systems` row per system checked. Whether someone
starts from Ground Transfer's own "new project" or Airport Transfer's, it is
the same underlying action; only which box comes pre-checked differs. A
project then appears with a working "Ground Transfer" tab if it has a
`('ground_transfer')` row, a working "Airport Transfer" tab if it has
`('airport_transfer')`, either, or both — and `/projects` (the shared list,
per `984`'s revised URL structure) should filter or badge on this, so an
airport-only client's project stops reading as broken to a Ground Transfer
dispatcher who opens it and finds an empty Ground Transfer tab.

## How this actually looks — two different "landing" moments, not one

Asked directly, so answered concretely rather than left to implementation to
guess. Superseded once by `984`'s revision — the strip-with-a-link this
section first described is now the three-tab structure `984` settled on;
kept here as the same idea, in its current shape:

**Account-level, `/` after login — unchanged from `984`.** One tile per row
in the `systems` registry, locked or not by account access alone. This page
knows nothing about any project yet:

```
┌───────────────────────────────────────────────┐
│  🚐 Ground Transfer        ✈️ Airport Transfer   │
│  [เข้าใช้งาน]                [🔒 ล็อก]             │
│                            ติดต่อผู้ดูแลระบบ         │
└───────────────────────────────────────────────┘
```

**Project-level, at `/projects/<project_code>/` — new, added by this
document, shaped by `984`'s later revision.** This is where
"โครงการนี้ใช้อะไรได้บ้าง" actually gets answered: three tabs, not a strip —
Ground Transfer, Airport Transfer, Settings. A tab for a system the project
has not enabled (no `project_systems` row) renders empty/locked rather than
missing entirely, the same "visible but not usable" rule `984` already
applies at the account level, one level down:

```
โครงการ: Chevron Q4 2026 (TOMP-20260911-DNZC)
┌─────────────────┬──────────────────┬──────────┐
│ 🚐 Ground        │ ✈️ Airport         │ ⚙️ Settings │
│  Transfer        │  Transfer         │           │
│  (กำลังดูอยู่)     │                  │           │
└─────────────────┴──────────────────┴──────────┘
```

Switching tabs is an ordinary navigation between
`/projects/<code>/ground-transfer` and `/projects/<code>/airport-transfer`
— no embedding, no shared frame, just the same `project_code` read by a
different facet of the same page. **Full path through the product:** tile
on `/` → `/projects` (the shared list) → a project card → this three-tab
page, where the Settings tab is where `984`'s granting model lives — one
shared member list across both facets, not split per system.

## Existing live data — the backfill decision, unchanged in substance

Seven real cases exist right now with no project, including flights scheduled
for tomorrow. Recommendation stands from the first pass, just targeting the
real `projects` table instead of a table that no longer exists in this
design: create one project (e.g. "เคสก่อนเริ่มใช้ระบบโครงการ"), give it a
`project_systems` row for `airport_transfer` only (not `ground_transfer` —
none of these seven ever touched TOMP's own side), and point all seven
cases' new `project_id` at it. Nobody is guessing a split from the three
distinct `client_name` values, since `null` on half the rows makes that
guess unreliable; whoever runs Airport Transfer day to day can re-split them
by hand afterward with better information than a migration script has.

## Where this sits relative to `984` — updated by `984`'s own later revision

This section originally argued Airport Transfer's roles stay flat and
account-level, independent of this document's `project_systems`. `984` has
since reversed that on its own side — Airport Transfer's roles are now
project-scoped too, via the same generalized `project_members` (with a
`system_key` column) that `984`'s Layer 2 defines. What remains true, and is
what this document actually contributes, is that **enablement and
membership are still two different questions, answered by two different
tables:**

- **`project_systems` (this document) — does this project use a system at
  all.** A coarse, person-independent flag. Can be set by whoever creates
  or edits the project even without personal access to that system
  themselves (`985` Part C already covers this) — it says "this engagement
  needs Airport Transfer," not "I can do Airport Transfer work."
- **`project_members` with `system_key` (`984`) — which specific person
  holds which specific role, on which system, for this project.** Requires
  the project to have enabled that system first; there is nothing to be a
  member *of* otherwise.

A case cannot exist under `airport_transfer` for a project that has no
`project_systems` row for it, and nobody can be granted an Airport Transfer
role on a project that has not enabled it — the two checks compose, they do
not duplicate each other.

## URLs

Superseded by `984`'s later revision, not merely unchanged: the prefix now
follows the *project*, not the other way around —
`/projects/<project_code>/ground-transfer` and
`/projects/<project_code>/airport-transfer` for the same `project_code`,
under `984`'s project-first hierarchy. What this document contributed —
that the same project can legitimately be viewed from either system's tab —
still holds; only the exact path shape changed. See `984`'s "URL structure"
section for the current, authoritative form.

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

## What was proposed and corrected, twice

First framing: "Airport Transfer *borrows* Ground Transfer's tracking
machinery" as an implementation detail, while still owning the case
throughout. **Rejected:** the right model is a genuine handoff — Airport
Transfer owns intake and preparation; at a deliberate moment, operational
ownership of the actual trip transfers outright, the same way a booking
system hands a confirmed order to fulfilment.

Second refinement, from Part A above: since a case's project and the
assignment it hands off into can now share the *same* `project_id`, there is
no separate "Ground Transfer project" to create or link to at handoff time —
it is the same project, referenced from two different table hierarchies. This
answers what used to be an open question outright (see below).

## The handoff, sketched

1. A case reaches a point someone decides it is ready to run — not automatic,
   a deliberate "ส่งงานต่อให้ Ground Transfer" action.
2. That action creates a real Ground Transfer call sign + assignment (using
   the case's driver, vehicle, pickup, dropoff, scheduled time) **inside the
   same `project_id` the case already belongs to** — the project already has
   a `ground_transfer` row in `project_systems` by this point, or gets one
   the first time a case under it is handed off.
3. The case's `operational_status` gains a value such as `handed_off`, and a
   new nullable column records which assignment it became.
4. **From that moment, Ground Transfer owns it completely.** The driver opens
   the same app, scans the same QR, shares GPS, sends messages — an ordinary
   Ground Transfer job with zero Airport-Transfer-specific code on that path.
   Editing dispatch details after handoff belongs on the Ground Transfer
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

## Worked examples — and why the checklist already fits this, unplanned

Two concrete scenarios, given directly, ground everything above in something
closer to a spec than a sketch:

- **Arrival:** the schedule is known in advance; Airport Transfer runs its
  normal intake and flight-verification work right up until the flight is
  about to land. At that point staff sends the driver a link; the driver
  presses it to accept the job at the scheduled time, and from then the
  system can track where the vehicle is and whether it is getting close to
  the pickup.
- **Departure:** a link is sent to the driver, the driver accepts the job —
  accepting *is* the acknowledgement, nothing separate needs ticking for
  that — and once the driver arrives at the pickup point, that real action
  is what checks the corresponding box, and so on for the statuses after it.

Reading `taskTemplate()` in `app/airport-transfer/actions.ts` shows the
checklist already has exactly the slots these two examples describe —
checked directly against the live function, not assumed from memory —
because it was written by someone already thinking about the same real
workflow:

| Task key (both directions) | Label | Matches |
|---|---|---|
| `driver_notified` | แจ้งงานคนขับแล้ว | "ลิงก์จะถูกส่งให้คนขับ" |
| `driver_confirmed` | คนขับรับทราบแล้ว | "คนขับกดรับงาน" — the accept *is* this tick, not a second step |

| Arrival task key | Matches a TOMP driver status | Departure task key | Matches |
|---|---|---|---|
| `vehicle_at_airport` | vehicle en route / live | `vehicle_en_route` | vehicle en route / live |
| — | — | `vehicle_at_pickup` | `arrived_pickup` |
| `passenger_on_board` | `passenger_onboard` | `passenger_on_board` | `passenger_onboard` |
| `destination_arrived` | `completed` | `airport_arrived` | `completed` |

So the auto-tick bridge in step 5 is not a new idea bolted onto an existing
checklist — it is closer to a 1:1 mapping between TOMP's own driver-status
vocabulary (`acknowledged | arrived_pickup | passenger_onboard | completed`)
and the task keys that already exist for both directions. This also answers
"when does the handoff fire," using columns already on the case, no new
schema: for `direction = 'arrival'`, the trigger window is around
`scheduled_arrival_at` (the flight's own landing time — which the existing
AirLabs polling in `flight-sync.ts` is already watching); for
`direction = 'departure'`, it is around `confirmed_pickup_at` (already
computed today from the flight time minus a lead time, in
`create-case-form.tsx`'s `formatSuggestedTime`). Neither direction needs a
new column to know when staff should be prompted to send the link — the
data staff would need to make that call already exists on the case.

## Open questions for whenever this is picked up

- Is the handoff reversible — can a case be pulled back before a driver
  actually starts, or is it one-way once created?
- ~~Does every Airport Transfer project get its own dedicated Ground Transfer
  project to hand off into~~ — **answered by Part A:** no, it is the same
  project, referenced from both sides. What remains open is only whether a
  project's `ground_transfer` `project_systems` row should be created
  automatically at first handoff, or must be enabled deliberately beforehand.
- Does a Ground Transfer dispatcher need to see, at a glance, that a given
  job originated from an Airport Transfer booking — and if so, how much of
  the passenger/flight context travels with it, versus staying only in the
  Airport Transfer case for reference?

None of these need answering to ship Part A.

---

# Part C — walking through it, start to finish

Two full journeys, asked for directly rather than left to inference. Walking
through them surfaced one rule that had never been decided; resolved inline
rather than left as an open question, since the journey does not make sense
without an answer.

## An account with both systems

1. Login → `/` → both tiles unlocked → clicks either one; say Ground
   Transfer.
2. `/projects` → "สร้างโครงการ" → the existing fields (code, name, dates,
   timezone, service level), plus the new "ระบบที่จะใช้ในโครงการนี้" section:
   Ground Transfer pre-checked, Airport Transfer also checked.
3. Submit → one `projects` row, two `project_systems` rows
   (`ground_transfer`, `airport_transfer`).
4. Lands on `/projects/<project_code>/ground-transfer` — the project's TOMP
   tab (the four-figure summary and mission board from `981`), alongside the
   project's other two tabs: Airport Transfer, and Settings.
5. Sets up the TOMP side as normal — resources, call signs, missions,
   assignments, QR.
6. Clicks the Airport Transfer tab → `/projects/<project_code>/airport-transfer`
   — same project, Airport Transfer's own pages, cases created against it via
   the new `project_id` column.
7. *(Once Part B ships — not now.)* A case reaches its trigger window
   (`scheduled_arrival_at` or `confirmed_pickup_at`), staff sends the driver
   a link, the case hands off — a Ground Transfer assignment appears under
   the same project, visible from the Ground Transfer side without any
   cross-system linking step, because it was always the same `project_id`.
8. Engagement ends → archive or delete the project once, from either side —
   same underlying action — and both systems' data for it moves together.

## An account with only one system

Symmetric, with the one rule this surfaced now resolved rather than left
open:

1. Login → `/` → one tile unlocked, the other locked with
   "ติดต่อผู้ดูแลระบบ".
2. Creates a project within their own system as usual. **The other system's
   checkbox still renders and is still selectable, even though this account
   cannot enter that system at all.** Resolved this way on purpose:
   declaring "this engagement will also need Airport Transfer" is a fact
   about the client, not a capability the creator personally needs to hold —
   the same distinction Part A already drew between account-level access and
   project-level scope, applied to who is *allowed to say* a project uses a
   system, not just who can *use* it once said. Checking it lets an
   `airport_dispatcher` find the project later; leaving it unchecked keeps
   the project single-system, extendable afterward the same way (next
   point).
3. On the project's three-tab page, each tab renders per the *viewer's* own
   access, not only what the project has enabled: a system the viewer can
   enter is a working tab; a system the project has enabled but this viewer
   cannot enter renders locked — "✈️ Airport Transfer (ใช้อยู่ในโครงการนี้)"
   with no working content behind it — so nobody clicks a tab into a
   dead-end access-denied page. This is `984`'s "visible but locked" rule,
   applied one level down from the top landing tiles to this project's own
   tabs.
4. Adding or removing a system later follows the same rule as step 2 —
   available to whoever can edit the project, regardless of whether they
   personally hold access to the system being toggled.
5. Archiving or deleting is unchanged for this account: one action, reaching
   whatever the project has enabled, same mechanism as the two-system
   journey above.
