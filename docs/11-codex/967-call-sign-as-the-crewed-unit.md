# 967 — The call sign becomes the crewed unit

A restructure proposed by the owner on 2026-09-10: a QR should belong to a
**driver + vehicle pairing**, not to a job. Ten drivers and ten vehicles means
ten QR codes, and the day's work is planned onto each of them.

This document records the analysis, the decisions taken, and the order to build
in. Nothing here is built yet.

---

## Why this is the right shape

The schema already reserved the concept and never used it.

`call_signs` exists, is unique per `(project_id, call_sign)`, and **every
assignment already points at one** — `call_sign_id` is `not null` with
`on delete restrict`. But the table holds only a label. The driver and the
vehicle live on each `assignments` row instead, chosen independently every time.

So nothing today enforces that call sign `CS-01` means the same driver and the
same vehicle from one job to the next. Two jobs on one call sign may name
different drivers and remain perfectly valid. The "wrong driver or vehicle gets
picked" risk the owner described is structural, not a slip of the hand.

The QR compounds it: `createDriverAccessTokenAction` issues **one token per
assignment**, with a bulk mode that issues many at once. That is the direct
cause of two problems already patched around:

- a driver with several jobs filled Mission Control with near-identical cards
  (patched with a runtime `groupBy` on 2026-09-10)
- reissuing a QR stranded the job history on the old token (patched with PIN
  re-binding the same day)

Both are symptoms of the credential being attached to the wrong noun. Moving it
to the pairing removes them by construction rather than by patch.

The timing is unusually good: production holds one project and **zero
assignments**, so there is almost nothing to migrate.

Two pieces of the schema already anticipate this:

- `driver_access_tokens.assignment_id` is **already nullable**
- `driver_access_tokens.access_scope` already exists, defaulting to `'assignment'`

Only `call_sign_id` has to be added.

---

## Decisions taken

| Question | Decision |
|---|---|
| How long does a pairing last? | The whole project, but the crew can be changed mid-way. |
| Does a crew change invalidate a printed QR? | **No.** The QR belongs to the call sign. Changing the crew issues a new PIN; the printed sheet stays valid. |
| What can an outside observer see? | Vehicle position, GPS status on a map, and where it is heading. Nothing about passengers. |
| Who unblocks a driver stuck on a job that cannot be completed? | **The control room only.** |

### Why the QR binds to the slot rather than to the people

The owner wants to print these. If the QR encoded "driver A in vehicle B", then
a breakdown or a shift swap would kill a piece of paper already in someone's
hand. Binding it to the call sign — the slot — means the paper outlives the
crew. The second factor stays honest because re-crewing regenerates the PIN and
clears the device binding, so the outgoing driver cannot open the slot again.

This is the same reasoning as the device re-binding work in `965`: the
credential should name a thing that does not change, and the facts that do
change get checked at the time of use.

---

## What has to change

### The pairing becomes real

`call_signs` gains `driver_id` and `vehicle_id`. Within one project a driver may
occupy at most one active call sign, and so may a vehicle — a partial unique
index, not application code, so it cannot be worked around.

Crew changes mutate those columns and append to an audit trail. History does not
need a temporal crew table: `assignments` already carries its own `driver_id`
and `vehicle_id`, which become a **snapshot of who was crewed when the job was
created** rather than an independent choice. Yesterday's jobs keep yesterday's
driver without any extra machinery.

### The QR moves to the call sign

A call-sign token sets `call_sign_id` and leaves `assignment_id` null, with
`access_scope = 'call_sign'`. Per-assignment tokens keep working, so the two can
coexist while the change lands.

The driver session (`dsess`) currently pins one assignment in its `aid` claim.
It has to carry the call sign instead and resolve the current job at request
time — the active one, or the next one due. **Seven API routes read
`context.assignmentId`**; that is the blast radius, and it is the largest single
piece of this work.

### Jobs are planned onto a pairing

Assignment creation moves onto the call sign's own page and inherits driver,
vehicle and call sign from the pairing. There is no driver or vehicle dropdown
to get wrong. Editing or removing a day's work happens on the same page, which
is what the owner asked for: one place per vehicle, so nothing is ambiguous.

### "เริ่มงาน" means the driver has acknowledged

Today the driver's first action is `arrived_pickup`. The control room therefore
cannot tell "the driver has not seen this job" from "the driver has seen it and
is on the way" — a real blind spot during a plan change.

A new status ahead of the existing three records acknowledgement and moves the
assignment to `active`. It is the driver saying *I have the job and I am
starting*, which is exactly what the owner asked for.

### One job at a time, with the control room holding the key

A call sign may have at most one assignment in `active`. The driver cannot start
a second job while one is running.

That invariant needs an escape hatch or it becomes a trap: a passenger who never
arrives, or a vehicle that breaks down, would block the crew for the rest of the
shift. **Only the control room** can cancel or park the blocking job — the
owner's decision, and the right one, since it keeps the plan under the authority
that owns it.

This also answers the urgent-change question raised earlier the same day: the
control room re-sequences the work and the driver acknowledges it, rather than
the driver picking jobs out of order on their own.

### A separate credential for outside observers

A read-only token for people who need to follow a vehicle but are not the
control room. It must be a **different kind of token, not the driver token with
a flag** — a flag is one bug away from granting write access.

It shows the vehicle on a map with its GPS freshness and current destination. It
carries no passenger details and no controls.

---

## Order of work

Each phase stands on its own and is worth shipping alone.

**1 — the pairing becomes real.** Migration, the pairing UI, assignment creation
inheriting from the call sign, fleet board grouped by call sign instead of the
runtime `groupBy`. No change to the QR yet, so nothing in the driver's hands
breaks.

**2 — the QR moves to the call sign.** Token scope, session carrying the call
sign, re-crew issuing a new PIN, and the printable sheet with QR and PIN. This
is where the duplicate-card and lost-history problems actually disappear.

**3 — the job flow.** Acknowledgement status, one-active-job rule, the control
room's cancel and park, and day planning on the pairing page.

**4 — the observer credential.** Read-only token and its own tracking page.

Phase 1 is safe to start immediately; it changes no credential anyone is
holding. Phase 2 is the one to schedule carefully, because it touches the seven
driver API routes and the session claim at once.

---

## Open, deliberately

- Where the coordinator's phone number lives. It is read from
  `assignment.metadata.coordinatorPhone` and **written nowhere except the test
  seeders**, so the driver's "call the centre" button never appears on real
  work. It belongs on the project as a default, overridable per assignment. Small
  and independent — worth doing before any of the above.
- Whether a call sign should span projects. Assumed no: the table is already
  scoped per project and the owner described planning inside a project.
