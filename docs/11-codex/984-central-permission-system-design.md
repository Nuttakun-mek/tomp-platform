# 984 — Central permission system: one login, two systems, and room for more

**Date:** 2026-09-18
**Status:** design, awaiting review before `writing-plans`
**Builds on:** `docs/11-codex/983-airport-transfer-consistency-audit.md` §2.5, which
first flagged that Airport Transfer's roles are a second, unconnected
authorization system.

## What changed from this document's first two passes

The first pass kept each system's role shape fully separate — TOMP
project-scoped via `project_members`, Airport Transfer flat and system-wide
via a new `module_memberships` table — arguing that Airport Transfer "has
never needed" project-scoping. That argument no longer holds: `985` gave
Airport Transfer's cases a `project_id`, so the people working those cases
belong to a project too, the same way TOMP's do. Granting access is now one
mechanism, not two, and it always happens from a project's own settings —
**`project_members` gains a `system_key` column instead of a new table being
built**, so both systems are granted the same way, in the same place, by the
same rule.

## Goal

After login, an account sees a landing page with one tile per system — today
รถ (Ground Transfer) and เครื่องบิน (Airport Transfer), more later. Every
tile is always visible; a tile the account has no grant for is locked, not
hidden. Every grant of access — to a system, within a project — happens from
that project's own settings, never from a separate top-level form.

---

## The three layers

### Layer 1 — system registry

```sql
create table public.systems (
  key text primary key,           -- 'ground_transfer' | 'airport_transfer' | future keys
  label_th text not null,
  icon text not null,             -- lucide icon name, e.g. 'CarFront' | 'PlaneTakeoff'
  route text not null,            -- 'ground-transfer' | 'airport-transfer' — a slug, not a fixed prefix; see "URL structure"
  is_active boolean not null default true,
  sort_order integer not null default 0
);
```

Two rows to start. Adding a third system later is one `insert`, not a schema
change.

### Layer 2 — project membership, generalized across systems

```sql
alter table public.project_members
  add column system_key text not null default 'ground_transfer'
    references public.systems(key);
-- Existing rows are all Ground Transfer memberships today, hence the default —
-- confirm this backfill is still correct at implementation time rather than
-- assumed here.
alter table public.project_members
  drop constraint if exists project_members_unique_membership; -- whatever it's actually named
alter table public.project_members
  add constraint project_members_project_system_profile_key
    unique (project_id, system_key, profile_id);
```

One row = one profile, one project, one system, one role. This **is** what
the first pass called `module_memberships`, folded into the table that
already does exactly this job for Ground Transfer — not a parallel table
Airport Transfer gets to itself. `airport_transfer_memberships` (currently
empty, per the 983 audit — re-check rather than assume, the other session
may have written to it since) is superseded, not migrated from; there is
nothing in it worth carrying forward.

`role_key` stays bare `text`: each system owns its own closed vocabulary in
code (Ground Transfer's `ROLE_PERMISSIONS`, Airport Transfer's
`AirportTransferRole` union), and validating "is this a real role for this
system" belongs at the application layer — a `system_key` + `role_key`
combination outside that system's own list is a validation error at write
time, not a DB constraint.

**A profile's role in a system is now genuinely per-project, both ways.**
Someone can be `airport_dispatcher` on one project and only `airport_driver`
helping out on another — the flat model the first pass proposed could not
express this at all; this can, for free, because it is the same mechanism
TOMP's own roles already use.

**Whether an account may see a system's tile on `/` at all** is now simply:
does this profile hold *any* active `project_members` row for that
`system_key`, anywhere — `super_admin` bypasses this and sees every tile
unlocked regardless.

### Layer 3 — task-level duty (existing column, currently unenforced — real gap, closing it here)

`airport_transfer_tasks.owner_role` already exists and is already written at
case-creation time (`taskTemplate()` in `app/airport-transfer/actions.ts`), but
**nothing checks it.** Every task-completing action gates on the same broad
`access.canManage` (`airport_admin` or `airport_dispatcher` only) regardless of
whose duty the step is labelled as — confirmed by reading every call site;
none compares the actor's role to `task.ownerRole`. `airport_coordinator`,
`airport_driver`, and `airport_viewer` are not distinguished anywhere in the
action layer today; those three roles exist only in the `AirportTransferRole`
type union with no behaviour attached.

This design closes that gap: completing a task additionally requires either
`access.canManage` (admin/dispatcher keep doing everything, unchanged) **or**
the actor's own role, *on that case's project*, equals the task's
`owner_role`. Now that role comes from the same `project_members` row Layer 2
just defined, so a driver's duty on one project cannot be confused with their
(possibly different) duty on another.

---

## URL structure

Two independent decisions, kept separate on purpose:

**A system's own prefix, for pages that are not about any one project.**
`/ground-transfer/**` and `/airport-transfer/**` still exist — but now hold
only what is genuinely system-wide, not project-scoped: Airport Transfer's
provider settings (`/airport-transfer/settings` — one AirLabs key, one
polling interval, for the whole system, not per project), and the token
pages a driver's already-installed app or an already-sent tracking link
depend on (`/ground-transfer/driver/[token]`, `/ground-transfer/fleet/[token]`,
`/ground-transfer/track/[token]`) — these stay exactly where the previous
pass of this document put them, resolved by the token alone, with no need
for a project code in the path.

**A project's own prefix, for everything scoped to one engagement.**
Given directly, correcting the previous pass: a project is the primary unit
now (`985`), so it leads the path, not the system —

```
/projects                                    → every project this account can see, + create new
/projects/<project_code>/ground-transfer/**  → this project's Ground Transfer facet
/projects/<project_code>/airport-transfer/** → this project's Airport Transfer facet
```

`project_code` (already the stable, unique, human-readable identifier —
`TOMP-20260911-DNZC`), not the project's free-text name, which can change and
collide. `/projects` alone — no code — is the one page that cannot live under
a project's own prefix, since there is no project yet to name; it is where
`create_project_command()` is called, and where the list of a viewer's own
projects (from the now-generalized `project_members`) is rendered.

**All of it moves cleanly; the old bare TOMP paths (`/projects`,
`/assignments`, `/mission-control`, `/resources`, `/recovery`, `/project`)
are simply gone, no redirect kept** — unchanged reasoning from the previous
pass: this is happening before the next rebuild and Apple resubmission, not
against a live tested surface, so a redirect layer would be solving a
problem that does not exist yet. The three external TestFlight testers on
build 3 lose their current QR the moment this ships and get a new one once
the next build — carrying the corrected `buildDriverWebUrl()` — reaches them,
deliberately, together.

`/login` and `/no-access` stay at root — they exist before a system or a
project is chosen, so neither prefix was ever going to claim them.

---

## Granting access — one mechanism, from one place, reached by two kinds of person

There is no separate top-level "create an account" form and no separate
"grant system access" screen. Every grant — adding an existing profile to a
project with a role, or bringing in someone who has never had any access
before — happens from that **project's own, single "Settings" tab**, because
a grant is always, concretely, "this profile gets this role on this
project's Ground/Airport work" — there is no version of granting access that
is not that.

**Concretely, a project's page has three tabs: Ground Transfer, Airport
Transfer, Settings** — the first two are that system's own operational
pages (mission control / resources for Ground Transfer, cases / imports for
Airport Transfer), shown or locked per whether `project_systems` has
enabled them; **Settings is one shared tab, not two** — it lists every
member across both systems together (each row tagged which system and role
it is), plus the `project_systems` toggles themselves. One place to see and
change everything about who is on this project, rather than splitting that
question by system the way the project's operational pages already are.

**Who can reach a project's settings to grant on it:**

- **Whoever already holds the right to manage that project** — a TOMP
  `project_manager` on their own project (a new permission,
  `project.manage_members`, checked with `requirePermission(projectId,
  "project.manage_members")` exactly like `assignment.update` already is —
  holding it says nothing about any other project), or the equivalent for
  Airport Transfer once that role differentiation ships (Layer 3's
  `airport_admin`/`airport_dispatcher`).
- **`super_admin` — reaches any project's settings, for the same reason they
  see every project in `/permission/projects`: they hold every role
  everywhere.** They use the identical settings screen a `project_manager`
  uses for their own project; there is no second, super-admin-only granting
  UI to keep in sync with the first.

This fixes a dangling promise already in the code: `SettingsView` in
`project/page.tsx` shows a project's member count today with an
"เพิ่ม/จัดการผู้ใช้" link pointing at `/superadmin/users` — which the
`project_manager` viewing their own project cannot open, since that page is
`super_admin`-only. It has never worked for the one person who most needs
it.

**Creating a brand-new person happens at the moment of granting, not before
it.** From a project's settings, adding someone who has never had access to
anything offers two paths, not one form with two cards:

- **A full account** — email, name, phone; they receive an invite, and the
  role being granted is attached the moment they accept. This is for anyone
  who needs to work across more than one project and wants the ordinary
  `/login` → `/` → pick-a-project experience.
- **A lightweight project helper** — name, nickname, phone, no email; a
  `profiles` row with `auth_user_id = null` (the same shape a driver's
  profile already has), plus a QR / short URL / PIN — reusable, not
  single-use, but revocable at any time the same way a driver's device
  binding already is: resetting the PIN cuts off whatever device was using
  the old one immediately. This is for someone who only ever needs this one
  project — an airport-transfer coordinator waiting to meet a passenger, for
  instance — and skips the landing page entirely, since the QR already says
  which project and which role; it lands them directly on their own
  role-scoped view (Layer 3's checklist for `airport_coordinator`, not the
  full case-management surface).

Both paths write the same kind of row — a `project_members` entry with a
`system_key` and a `role_key` — differing only in how the person
authenticates into it. Neither needs its own separate permission table.

## The landing page

Lives at root, `/` — replacing today's `RootPage`, which currently just
`redirect("/projects")`s unconditionally. Server-rendered from `systems`
joined against whether the signed-in profile holds any `project_members` row
for each `system_key` (`super_admin` bypasses this and sees every tile
unlocked). Every active system row renders a tile; a tile the account cannot
enter renders locked, with one line naming who to ask — a fixed
"ติดต่อผู้ดูแลระบบ" is enough, this is not a self-service request flow.
Replaces today's `REDIRECT_BY_ROLE` auto-redirect on login: an account is no
longer sent straight into Ground Transfer even if that is its only system,
because "ทุกคนเห็นระบบทุกระบบ" was explicit.

**Checked against natural usage, not just decided and left.** For the
majority — an account with exactly one granted system — this adds one click
on login that did not exist before. Kept anyway, deliberately: it costs that
click once per login, not once per page, since nothing after clicking
through routes back to `/` during ordinary work. The friction that would
actually matter — someone working two systems on the same engagement having
to return to `/` every time they switch — is solved separately: `985` puts a
direct system-switch link on the project detail page itself, so mid-work
switching never touches the root picker at all.

## Platform-wide oversight — `/permission`, viewing only, nothing granted here

Root-level, unprefixed by either system, reachable only to `super_admin`
(`anyRole: ["super_admin"]`, matching how `/superadmin` is already gated in
`nav-model.ts`). Replaces `/superadmin` and its remaining pages — but as
**oversight, not as where granting happens**, since granting moved into
project settings above:

| Path | What it is | Why it stays platform-level |
|---|---|---|
| `/permission/projects` | Every project, across every owner (replaces `/superadmin/projects`, whose own description is "โครงการทั้งหมดในระบบ") | Crosses every project's own membership boundary by nature |
| `/permission/audit` | Cross-project activity (replaces `/superadmin/audit`, "ข้ามทุกโครงการในระบบ" per its own description) | Same reason |
| `/permission/roles` | The role × permission matrix (replaces `/superadmin/roles`) | Platform-level by nature; TOMP-only today, a natural place to add Airport Transfer's role list later |

`super_admin` does not grant anything from here — finding a project in
`/permission/projects` and opening it takes them to that same project's own
settings, the identical screen a `project_manager` would use on their own
project.

`/ground-transfer/superadmin/dev-tools/**` (moved from
`/superadmin/dev-tools/**`) is **not** part of this platform oversight
surface — confirmed TOMP-specific: driver QR, GPS, and the Apple review demo
all test Ground Transfer's own pipeline, nothing Airport Transfer touches,
so it lives under that system's own prefix instead.

## Permission matrix

| System | Role | Can do | Status |
|---|---|---|---|
| Ground Transfer | `super_admin` | everything | unchanged |
| Ground Transfer | `project_manager` | full control of its project(s): publish, missions, assignments, resources, **and now its own members** | +`project.manage_members`, scoped to projects they manage |
| Ground Transfer | `dispatcher` | assignments, QR, resources, status | unchanged |
| Ground Transfer | `coordinator` | read + confirm on-ground status | unchanged |
| Ground Transfer | `customer_viewer` | read-only + change requests | unchanged |
| Ground Transfer | `driver` | QR flow only, never an admin-created login | unchanged |
| Airport Transfer | `airport_admin` | manage all cases for projects they hold this role on, provider settings, grant/revoke this project's Airport Transfer access | now project-scoped, not system-wide |
| Airport Transfer | `airport_dispatcher` | create/edit/cancel/restore cases on their project | unchanged today in capability (currently identical to admin minus granting), now project-scoped |
| Airport Transfer | `airport_coordinator` | **new behaviour required:** read all cases on their project, update operational status, cannot edit case core fields or cancel — today undifferentiated from `viewer` in the code, since nothing checks it |
| Airport Transfer | `airport_driver` | **new behaviour required:** see only assigned cases; complete only tasks where `owner_role = 'airport_driver'` on their project (Layer 3) |
| Airport Transfer | `airport_viewer` | read-only — already effectively true, since nothing grants this role any write path |

Rows marked "new behaviour required" are gaps in the *current* Airport
Transfer code, not something this design invents and then has to reconcile —
confirmed by reading `apps/web/app/airport-transfer/actions.ts` end to end.

---

## What this does not touch

- TOMP's `roles` / `role_permissions` tables and every RLS policy or trigger
  reading `project_members` — unchanged in shape; only a new column and a
  wider unique constraint are added to the latter.
- `airport_transfer_cases` / `_tasks` / `_status_events` / `_flight_snapshots`
  / `_audit_logs` / `_import_*` / `_api_health` — unchanged.
- Not the login/landing surface itself — drivers never see it, they reach a
  job through the QR flow. `apps/mobile-driver/**` needs the coordinated
  change described under "URL structure": `buildDriverWebUrl()` must point
  at `/ground-transfer/driver/${token}` in the same build/deploy this ships
  with — there is no redirect to fall back on, so the server cutover and
  that app change land together.
- Every server-side URL generator that mints a link — `buildDriverAccessUrl()`,
  `observer-access.ts`'s fleet/track builder — emits the new
  `/ground-transfer/...` path from day one.

## Next step

Pending review of this document: `superpowers:writing-plans` for the phased,
file-by-file implementation plan (`project_members` migration, registry,
project-settings granting UI for both system facets, the lightweight helper
QR/PIN path, task-ownership enforcement, retiring `/superadmin` in favour of
`/permission`).
