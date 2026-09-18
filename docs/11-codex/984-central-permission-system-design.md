# 984 — Central permission system: one login, two systems, and room for more

**Date:** 2026-09-18
**Status:** design, awaiting review before `writing-plans`
**Builds on:** `docs/11-codex/983-airport-transfer-consistency-audit.md` §2.5, which
first flagged that Airport Transfer's roles are a second, unconnected
authorization system. This document is the deliberate decision that section
left open — resolved here as: keep each system's own role catalog, but govern
*access to* every system from one place.

## Goal

After login, an account sees a landing page with one tile per system — today
รถ (TOMP) and เครื่องบิน (Airport Transfer), more later. Every tile is always
visible; a tile the account has no grant for is locked, not hidden. One
super-admin-only screen grants and edits access to every system for every
account, and creating a new account forces a decision for both systems at
once — no silent "forgot to set it" gap.

## Why not just merge the two role catalogs into one

TOMP's roles are project-scoped (`project_manager` on project A, a different
role on project B) via `project_members`; Airport Transfer's are flat (one role,
system-wide) via `airport_transfer_memberships`. Forcing TOMP's richer,
per-project model into Airport Transfer's flat shape would lose per-project
granularity that TOMP's RLS, timeline triggers, and `requirePermission()` all
depend on today. Forcing Airport Transfer's flat model to become project-scoped
would invent project-scoping it has never needed. Each system keeps the role
shape that fits its own data. What becomes central is a layer *above* both:
whether an account may enter a system at all, and — for flat-role systems —
which role it holds there.

---

## The three layers

### Layer 1 — system registry (new)

```sql
create table public.systems (
  key text primary key,           -- 'tomp' | 'airport_transfer' | future keys
  label_th text not null,
  icon text not null,             -- lucide icon name, e.g. 'CarFront' | 'PlaneTakeoff'
  route text not null,            -- '/ground-transfer' | '/airport-transfer'
  is_active boolean not null default true,
  sort_order integer not null default 0
);
```

Two rows to start. Adding a third system later is one `insert`, not a schema
change — this is what makes the registry the thing that scales, per the
explicit ask that more systems are coming. `route` is a URL prefix, not just
an entry page — see "URL structure" below for what that does and does not
cover.

### URL structure — one prefix per system, with a hard exception

The ask was explicit: give each system its own URL namespace so the split is
visible in the address bar, not just in code —
`tomp-platform.vercel.app/ground-transfer/...` for TOMP,
`/airport-transfer/...` for Airport Transfer, and any future system claims its
own prefix the same way. Airport Transfer already matches this shape today —
every one of its pages sits under `/airport-transfer/**`. TOMP does not; its
pages sit at bare paths (`/projects`, `/assignments`, `/mission-control`,
`/resources`, `/recovery`, `/superadmin`, `/project`, and `/`).

**Renaming TOMP's paths is safe for the eight pages above and only those.**
Nothing external points at them; the only cost is updating roughly 34 files
that hardcode the literal strings (`grep`-confirmed) — mechanical, no design
risk.

**Five paths must never move, permanently, regardless of how many systems
this registry grows to:** `/driver/[token]`, `/driver`, `/fleet/[token]`,
`/track/[token]`, `/login`, `/no-access`. The reason is not symmetry with
Airport Transfer's shell — it's that the first four are URLs already handed
out and baked into things this repo cannot edit after the fact:

- `apps/mobile-driver/src/config.ts`'s `buildDriverWebUrl()` constructs
  `${origin}/driver/${token}` and is compiled into every app binary already
  installed on a driver's phone right now, including the build in Apple's
  reviewer's hands. Moving `/driver` breaks every one of those installs
  immediately, with no server-side fix possible — the app would need a new
  build to catch up, which the owner has stood down for the moment.
- `/fleet/[token]` and `/track/[token]` are literal links already sent to real
  people — a customer's fleet-tracking link, and the demo link handed to
  Apple's reviewer yesterday (`984`'s sibling document, `983`, and the Apple
  review work earlier this session). Moving them breaks a link that cannot be
  re-sent to whoever already has it.
- `/login` and `/no-access` stay at root because they exist *before* a system
  is chosen — they are not "TOMP's" or "Airport Transfer's" to claim a prefix
  for.

So: `route` in the registry means "where this system's *authenticated staff
app* lives," never the public/token surface. TOMP's `route` becomes
`/ground-transfer`; its `/driver`, `/fleet`, `/track` pages stay exactly where
they are, owned by no system's prefix, forever.

### Layer 2 — module access + role (new, generic, for flat-role systems)

```sql
create table public.module_memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  system_key text not null references public.systems(key),
  role_key text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, system_key)
);
```

This **is** `airport_transfer_memberships`, generalized with a `system_key`
column so any future flat-role module reuses this same table instead of one
more bespoke membership table per module. Migration: add `system_key`, backfill
`'airport_transfer'` on whatever rows exist at migration time (zero, as of the
983 audit, but re-check rather than assume — the other session may have
granted itself access since), and either rename the table or point
`getAirportTransferAccess()` at the new one — a decision for the implementation
plan, not this design.

`role_key` is deliberately bare `text`, not a foreign key into a shared role
catalogue: each system already owns its own closed vocabulary in code (TOMP's
`ROLE_PERMISSIONS`, Airport Transfer's `AirportTransferRole` union), and
validating "is this a real role for this system" belongs at the application
layer, the same way `AirportTransferRole` is checked today — a `system_key` +
`role_key` combination that isn't in that system's own list is a validation
error at write time, not a DB constraint.

TOMP does **not** move into this table. TOMP access is derived, not stored
here: an account may enter TOMP if it is `super_admin` **or** holds at least
one active `project_members` row **or** a global `user_role_assignments` row —
exactly the check `getViewerAccess()` already assembles today. The landing
page's TOMP tile reads that existing derivation; nothing about TOMP's schema
changes.

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
the actor's own role equals that task's `owner_role`. This is what makes
"บทบาทที่มีหน้าที่ต้องเช็คลิสต์" — the specific concern raised about the airport
pickup point / handoff step — actually mean something: an `airport_driver` can
tick only the steps templated as theirs, not the whole case.

---

## The account-creation and account-editing flow

One form, both systems, every time — creating an account and editing one later
use the same shape.

1. Identity fields (email, name, phone) — unchanged from today's
   `InviteUserForm`.
2. **Two system cards, both defaulting to off, both requiring an explicit
   choice** — a submit with neither touched is a valid "no access to
   anything yet" account, not an accidental one, because the form makes the
   admin look at both before saving.
   - **TOMP card, toggled on** → reveals today's existing controls unchanged:
     pick one or more projects, pick a role per project
     (`project_manager | dispatcher | coordinator | customer_viewer` — **not**
     `driver`, which never gets an admin-created login; it is QR-only).
     Toggled off → no `project_members` row is written; the account cannot
     open TOMP at all, matching "ถ้าไม่ให้สิทธิ์ระบบใดระบบหนึ่งก็ไม่สามารถเข้าได้."
   - **Airport Transfer card, toggled on** → reveals a single role picker
     (`airport_admin | airport_dispatcher | airport_coordinator | airport_driver
     | airport_viewer`). Toggled off → no `module_memberships` row.
3. Submit writes: the profile/auth user (as today), then whichever of the two
   membership writes the toggles called for. Editing an existing account
   reads the current state into the same two cards and diffs on save
   (toggle off an already-on card → the existing row's `status` becomes
   `'revoked'`, not deleted, so the grant history survives).

## The landing page

Lives at root, `/` — replacing today's `RootPage`, which currently just
`redirect("/projects")`s unconditionally. Server-rendered from `systems`
joined against what the signed-in account actually holds (TOMP via the
derived check above, every other system via `module_memberships`). Every
active system row renders a tile; a tile the account cannot enter renders
locked, with one line naming who to ask (a fixed "ติดต่อผู้ดูแลระบบ" is enough
— this is not a self-service request flow). Also replaces today's
`REDIRECT_BY_ROLE` auto-redirect on login: an account is no longer sent
straight into TOMP, even if TOMP is its only system, because "ทุกคนเห็นระบบทุกระบบ"
was explicit — the picker always shows, and lives at the one root path that
was never going to be claimed by any single system's prefix anyway.

## The central admin page

Lives at `/permission` — root-level, unprefixed by either system's namespace,
for the same reason `/` and `/login` are: it governs both systems and belongs
to neither. Reachable only to `super_admin` (`anyRole: ["super_admin"]`,
matching how `/superadmin` is already gated in `nav-model.ts`). It **replaces**
today's `/superadmin/users`, which currently only manages TOMP project roles.
`apps/web/app/airport-transfer/settings/page.tsx` exists today, but the 983
audit found no admin surface anywhere touching `airport_transfer_memberships`
— that page is provider/polling configuration (AirLabs key, sync interval),
not user access, so there is nothing to retire there; per
"จะไม่มีหน้าแอดมิน ในระบบ ของแต่ละระบบ," it simply never grows one. The new page
holds the account-creation/editing form described above, plus a list of every
account showing, per system, what it currently holds — the same two-card
shape used to create a user, opened for editing.

## Permission matrix

| System | Role | Can do | Status |
|---|---|---|---|
| *(registry)* | *(any)* | `system.access:<key>` — may this account even see this system as unlocked | new concept, layer 2 |
| TOMP | `super_admin` | everything | unchanged |
| TOMP | `project_manager` | full control of its project(s): publish, missions, assignments, resources | unchanged |
| TOMP | `dispatcher` | assignments, QR, resources, status | unchanged |
| TOMP | `coordinator` | read + confirm on-ground status | unchanged |
| TOMP | `customer_viewer` | read-only + change requests | unchanged |
| TOMP | `driver` | QR flow only, never an admin-created login | unchanged |
| Airport Transfer | `airport_admin` | manage all cases, provider settings, grant/revoke this system's access | unchanged today |
| Airport Transfer | `airport_dispatcher` | create/edit/cancel/restore cases, assign driver+vehicle | unchanged today (currently identical to admin minus granting access) |
| Airport Transfer | `airport_coordinator` | **new behaviour required:** read all cases, update operational status, cannot edit case core fields or cancel — today this role is undifferentiated from `viewer` in the code, since nothing checks it |
| Airport Transfer | `airport_driver` | **new behaviour required:** see only assigned cases; complete only tasks where `owner_role = 'airport_driver'` (layer 3) |
| Airport Transfer | `airport_viewer` | read-only — already effectively true, since nothing grants this role any write path |

Rows marked "new behaviour required" are gaps in the *current* Airport
Transfer code, not something this design invents and then has to reconcile —
confirmed by reading `apps/web/app/airport-transfer/actions.ts` end to end.
Closing them is part of this plan, not a side effect of it.

---

## What this does not touch

- TOMP's `roles` / `role_permissions` / `project_members` tables and every RLS
  policy or trigger reading them — unchanged.
- `airport_transfer_cases` / `_tasks` / `_status_events` / `_flight_snapshots`
  / `_audit_logs` / `_import_*` / `_api_health` — unchanged; only
  `_memberships` gains a column and a new caller.
- Nothing in `apps/mobile-driver/**` — drivers reach TOMP through the QR flow,
  never through this login/landing surface.
- `/driver/[token]`, `/driver`, `/fleet/[token]`, `/track/[token]`, `/login`,
  `/no-access` — see "URL structure" above. These do not move now and must
  not move later, even when a third or fourth system joins the registry.

## Open item carried from the last design pass, now answered by this doc

Whether `airport_coordinator` needed its own behaviour was left open in the
prior conversation turn. Reading the action layer end to end (this pass)
confirms it currently has none — folded into "new behaviour required" above
rather than left as a standing question.

## Next step

Pending review of this document: `superpowers:writing-plans` for the phased,
file-by-file implementation plan (registry + membership migration, landing
page, central admin form, task-ownership enforcement, retiring the old
`/superadmin/users` in favour of the new page).
