# Central Permission System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give TOMP (Ground Transfer) and Airport Transfer one shared login landing page, one shared per-project permission model (`project_members` + `system_key`), and one shared granting mechanism (a project's own Settings tab) — replacing Airport Transfer's disconnected flat `airport_transfer_memberships` table and TOMP's `/superadmin`-only granting dead end.

**Architecture:** Both systems already model "a real-world engagement" as a `projects` row. This plan makes that row the single unit both systems attach to (`project_systems` says which systems it uses; `airport_transfer_cases.project_id` replaces the always-null `external_tomp_project_id`), generalizes `project_members` with a `system_key` column so "who can do what, on this project, in this system" is one table for both systems, and restructures URLs so a project's own code leads the path (`/projects/<project_code>/ground-transfer`, `/projects/<project_code>/airport-transfer`) with a shared three-tab shell (Ground Transfer / Airport Transfer / Settings) around both facets.

**Tech Stack:** Next.js 15 App Router (`apps/web`), Supabase Postgres (`database/migrations/*.sql`, applied via `node scripts/apply-migrations.mjs`, mirrored into `supabase/migrations/`), Vitest (`npm run test -w @tomp/web`), Zod for server-action input validation.

**Source design docs (read before starting, both already committed and internally consistent):**
- `docs/11-codex/984-central-permission-system-design.md`
- `docs/11-codex/985-airport-transfer-project-entity-and-handoff.md` (Part A only — Part B, the Ground Transfer handoff, is explicitly deferred; no task below touches it)

## Global Constraints

- Next free migration number is `0043` (confirmed against both `database/migrations/` and `supabase/migrations/` — see `docs/11-codex/983`). Every migration task below claims the next free number *at the time you run it*; re-check `ls database/migrations | sort | tail -5` before writing the file, since another session pushes to this same `main`.
- Every migration file gets applied with `node scripts/apply-migrations.mjs` (writes to `database/migrations/`) **and** mirrored into `supabase/migrations/` with `node scripts/sync-supabase-migrations.mjs` — both steps, every time, matching how `0040`–`0042` were done.
- `apps/mobile-driver/**` is owned by a separate session/agent per the project's standing mobile/web boundary. No task in this plan edits it. Task 6 leaves an explicit, named dependency note instead of a code change, because `buildDriverWebUrl()` in `apps/mobile-driver/src/config.ts:32` must be updated to point at the new `/ground-transfer/driver/${token}` path in the *same deploy* — there is deliberately no redirect kept at the old bare `/driver` path once this ships.
- `git fetch --all` and check `git log HEAD..origin/main --oneline` is empty before every commit in this plan — a parallel session pushes to this repo's `main`.
- No placeholder role/permission behavior: every new permission key gets a real row in `public.permissions` and `public.role_permissions`, and every new role key gets a real row in `public.roles` — nothing is left as a comment saying "grant this later."
- Thai user-facing copy follows the existing convention in this codebase (short, direct, no jargon) — copy the tone of nearby strings rather than inventing a new register.

---

## Part 1 — Database foundation

### Task 1: Systems registry, `project_members.system_key`, `project_systems`

**Files:**
- Create: `database/migrations/0043_central_permission_foundation.sql`
- Copy: `supabase/migrations/0043_central_permission_foundation.sql` (identical content, via `scripts/sync-supabase-migrations.mjs`)
- Test: `scripts/verify-schema.mjs` (existing script — run, don't modify) plus a one-off verification query (Step 4 below)

**Interfaces:**
- Produces: `public.systems(key, label_th, icon, route, is_active, sort_order)` — 2 seed rows, `ground_transfer` and `airport_transfer`.
- Produces: `public.project_members.system_key text not null default 'ground_transfer' references public.systems(key)` — every existing row backfilled to `'ground_transfer'` by the column default.
- Produces: constraint `project_members_project_system_profile_key unique (project_id, system_key, profile_id)`, replacing `project_members_unique unique (project_id, profile_id, role_id)` (the real, confirmed name from `database/migrations/0004_auth_rbac_foundation.sql:55` — not a placeholder).
- Produces: `public.project_systems(project_id, system_key, enabled_at, enabled_by)`, PK `(project_id, system_key)`.
- Consumed by: Task 2 (airport role rows), Task 4 (Layer 3 role lookup), Task 5 (project-scoped access), Task 9–11 (project shell + Settings tab), Task 14 (project creation).

- [ ] **Step 1: Write the migration file**

```sql
-- 0043_central_permission_foundation.sql
-- Central permission system, Layer 1 + Layer 2 (docs/11-codex/984).
-- Layer 1: a registry of "systems" a login can hold access to.
-- Layer 2: project_members generalized across systems via system_key, so
-- Airport Transfer's roles become project-scoped the same way TOMP's already
-- are, instead of living in the separate, disconnected, empty
-- airport_transfer_memberships table (docs/11-codex/983 §2.5).

create table public.systems (
  key text primary key,
  label_th text not null,
  icon text not null,
  route text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

insert into public.systems (key, label_th, icon, route, sort_order) values
  ('ground_transfer', 'Ground Transfer', 'CarFront', 'ground-transfer', 0),
  ('airport_transfer', 'Airport Transfer', 'PlaneTakeoff', 'airport-transfer', 1);

grant select on public.systems to authenticated, anon;
grant all on public.systems to service_role;
alter table public.systems enable row level security;
create policy systems_select_all on public.systems for select using (true);

-- Layer 2: one row = one profile, one project, one system, one role.
alter table public.project_members
  add column system_key text not null default 'ground_transfer'
    references public.systems(key);

alter table public.project_members
  drop constraint project_members_unique;
alter table public.project_members
  add constraint project_members_project_system_profile_key
    unique (project_id, system_key, profile_id);

create index project_members_system_key_idx on public.project_members(project_id, system_key);

-- Which systems a project uses. Coarse, person-independent — "this engagement
-- needs Airport Transfer," not "I personally can do Airport Transfer work."
-- See docs/11-codex/985 Part A, "Where this sits relative to 984."
create table public.project_systems (
  project_id uuid not null references public.projects(id) on delete cascade,
  system_key text not null references public.systems(key),
  enabled_at timestamptz not null default now(),
  enabled_by uuid references public.profiles(id) on delete set null,
  primary key (project_id, system_key)
);

grant select on public.project_systems to authenticated;
grant all on public.project_systems to service_role;
alter table public.project_systems enable row level security;

create policy project_systems_select on public.project_systems
  for select
  using (
    exists (
      select 1 from public.project_members pm
      join public.profiles p on p.id = pm.profile_id
      where pm.project_id = project_systems.project_id
        and pm.status = 'active'
        and p.auth_user_id = (select auth.uid())
    )
  );

-- Every project that already exists uses Ground Transfer today (it is the
-- only system that has ever had projects). Airport Transfer's own project
-- row is backfilled in the next migration once cases have somewhere to point.
insert into public.project_systems (project_id, system_key)
select id, 'ground_transfer' from public.projects
on conflict do nothing;
```

- [ ] **Step 2: Confirm the constraint name being dropped is real**

Run: `grep -n "project_members_unique" database/migrations/0004_auth_rbac_foundation.sql`
Expected: `constraint project_members_unique unique (project_id, profile_id, role_id)` — confirms the `drop constraint project_members_unique` line above targets a real, existing constraint, not a guess.

- [ ] **Step 3: Apply the migration**

Run: `node scripts/apply-migrations.mjs --dry-run` (confirm `0043` shows as pending and nothing else does)
Run: `node scripts/apply-migrations.mjs`
Run: `node scripts/sync-supabase-migrations.mjs`
Expected: `0043` applied; `supabase/migrations/0043_central_permission_foundation.sql` now exists with identical content.

- [ ] **Step 4: Verify against the live database**

Run:
```
psql "$DATABASE_URL" -c "select key, label_th, route from public.systems order by sort_order;"
psql "$DATABASE_URL" -c "select count(*) from public.project_members where system_key = 'ground_transfer';"
psql "$DATABASE_URL" -c "select count(*) from public.project_systems where system_key = 'ground_transfer';"
```
Expected: 2 rows in `systems`; the `project_members` count equals the pre-migration row count of `project_members` (every row backfilled, none dropped); the `project_systems` count equals the number of rows in `projects`.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/0043_central_permission_foundation.sql supabase/migrations/0043_central_permission_foundation.sql
git commit -m "Add systems registry, project_members.system_key, project_systems (984 Layer 1+2)"
```

---

### Task 2: Airport Transfer cases get a real `project_id`; audit/import rows become real deletes; Airport Transfer roles enter `public.roles`

**Files:**
- Create: `database/migrations/0044_airport_transfer_project_scoping.sql`
- Copy: `supabase/migrations/0044_airport_transfer_project_scoping.sql`

**Interfaces:**
- Produces: `public.airport_transfer_cases.project_id uuid references public.projects(id) on delete cascade` (replaces `external_tomp_project_id`, dropped in the same migration).
- Produces: `airport_transfer_audit_logs.case_id` and `airport_transfer_import_rows.imported_case_id` FKs changed to `on delete cascade` (user-confirmed decision, `docs/11-codex/985` "The one real gap this surfaced — decided").
- Produces: 5 new rows in `public.roles` — `airport_admin`, `airport_dispatcher`, `airport_coordinator`, `airport_driver`, `airport_viewer` — so `project_members.role_id` (a real FK to `public.roles(id)`, confirmed in `database/migrations/0004_auth_rbac_foundation.sql:45` — **not** a bare text column, correcting an assumption in `984`'s migration sketch) can hold an Airport Transfer role. These rows get **no** `role_permissions` rows yet — Airport Transfer's own `getAirportTransferAccess()` (Task 5) reads the role directly, it does not go through `roleHasPermission()`. Wiring them into `role_permissions` is future work for whenever `/permission/roles` grows an Airport Transfer section (`984`'s "Permission matrix" table already anticipates this and is not part of this plan).
- Produces: one legacy project ("เคสก่อนเริ่มใช้ระบบโครงการ") with a `project_systems` row for `airport_transfer` only, holding the 7 pre-existing live cases.
- Consumed by: Task 4, Task 5 (both query `airport_transfer_cases.project_id` and `project_members` joined to these 5 role rows).

- [ ] **Step 1: Check the exact FK constraint names before writing the drop statements**

Run: `grep -n "case_id uuid references public.airport_transfer_cases\|imported_case_id uuid references" database/migrations/0040_airport_transfer_foundation.sql`
These are inline column constraints with no explicit name, so Postgres auto-named them `<table>_<column>_fkey`. Confirm live before applying:
Run: `psql "$DATABASE_URL" -c "\d public.airport_transfer_audit_logs" | grep -i foreign` and `psql "$DATABASE_URL" -c "\d public.airport_transfer_import_rows" | grep -i foreign`
Expected names: `airport_transfer_audit_logs_case_id_fkey`, `airport_transfer_import_rows_imported_case_id_fkey`. If the live names differ, use the real names in Step 2 instead of these — do not guess a second time.

- [ ] **Step 2: Write the migration file**

```sql
-- 0044_airport_transfer_project_scoping.sql
-- docs/11-codex/985 Part A: one shared project instead of a second,
-- Airport-Transfer-only project table. A case now belongs to a real TOMP
-- project the same way a driver assignment does.

alter table public.airport_transfer_cases
  add column project_id uuid references public.projects(id) on delete cascade;

drop index if exists airport_transfer_cases_tomp_project_idx;
alter table public.airport_transfer_cases drop column external_tomp_project_id;

create index airport_transfer_cases_project_idx on public.airport_transfer_cases(project_id);

-- Decided (user, 2026-09-18): a project delete must actually clear a
-- client's data, not leave passenger names/phones behind under an orphaned
-- SET NULL row nobody will ever query for. See docs/11-codex/985.
alter table public.airport_transfer_audit_logs
  drop constraint airport_transfer_audit_logs_case_id_fkey;
alter table public.airport_transfer_audit_logs
  add constraint airport_transfer_audit_logs_case_id_fkey
    foreign key (case_id) references public.airport_transfer_cases(id) on delete cascade;

alter table public.airport_transfer_import_rows
  drop constraint airport_transfer_import_rows_imported_case_id_fkey;
alter table public.airport_transfer_import_rows
  add constraint airport_transfer_import_rows_imported_case_id_fkey
    foreign key (imported_case_id) references public.airport_transfer_cases(id) on delete cascade;

-- Airport Transfer's 5 roles enter the shared roles table so
-- project_members.role_id (a real FK, not a bare text column) can hold them.
-- No role_permissions rows yet — access.ts (Task 5) checks these directly.
insert into public.roles (role_key, role_name, description) values
  ('airport_admin', 'Airport Transfer Admin', 'Manages all Airport Transfer cases and settings for the projects they hold this role on.'),
  ('airport_dispatcher', 'Airport Transfer Dispatcher', 'Creates and edits Airport Transfer cases for the projects they hold this role on.'),
  ('airport_coordinator', 'Airport Transfer Coordinator', 'Updates operational status on Airport Transfer cases; cannot edit case core fields.'),
  ('airport_driver', 'Airport Transfer Driver', 'Completes only the checklist steps assigned to the driver role.'),
  ('airport_viewer', 'Airport Transfer Viewer', 'Read-only access to Airport Transfer cases.')
on conflict (role_key) do nothing;

-- Backfill: one project absorbs the 7 pre-existing live cases, tagged for
-- Airport Transfer only (none of these ever touched TOMP's own side).
do $$
declare
  v_org_id uuid;
  v_project_id uuid;
begin
  select id into v_org_id from public.organizations order by created_at asc limit 1;

  insert into public.projects
    (organization_id, project_code, project_name, start_date, end_date, timezone, visibility_level, service_level, status, metadata)
  values
    (v_org_id, 'APT-LEGACY-0001', 'เคสก่อนเริ่มใช้ระบบโครงการ', current_date, current_date + interval '1 year',
     'Asia/Bangkok', 'internal', 'standard', 'operating', jsonb_build_object('legacyAirportTransferBackfill', true))
  returning id into v_project_id;

  insert into public.project_systems (project_id, system_key) values (v_project_id, 'airport_transfer');

  update public.airport_transfer_cases set project_id = v_project_id where project_id is null;
end $$;
```

- [ ] **Step 3: Apply and mirror**

Run: `node scripts/apply-migrations.mjs --dry-run` then `node scripts/apply-migrations.mjs`
Run: `node scripts/sync-supabase-migrations.mjs`

- [ ] **Step 4: Verify against the live database**

Run:
```
psql "$DATABASE_URL" -c "select count(*) from public.airport_transfer_cases where project_id is null;"
psql "$DATABASE_URL" -c "select role_key from public.roles where role_key like 'airport_%' order by role_key;"
psql "$DATABASE_URL" -c "select project_code, project_name from public.projects where metadata->>'legacyAirportTransferBackfill' = 'true';"
```
Expected: `0` cases with a null `project_id`; exactly the 5 `airport_*` role keys; exactly 1 legacy project row.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/0044_airport_transfer_project_scoping.sql supabase/migrations/0044_airport_transfer_project_scoping.sql
git commit -m "Give Airport Transfer cases a real project_id; CASCADE audit/import FKs; seed 5 airport_* roles"
```

---

### Task 3: `project.manage_members` permission

**Files:**
- Create: `database/migrations/0045_project_manage_members_permission.sql`
- Copy: `supabase/migrations/0045_project_manage_members_permission.sql`
- Modify: `apps/web/lib/auth/permissions.ts:12-32` (the `project_manager` array inside `ROLE_PERMISSIONS`)
- Test: `apps/web/lib/auth/permissions.test.ts` (new file)

**Interfaces:**
- Produces: permission key `project.manage_members` — project-scoped (not added to `GLOBAL_PERMISSIONS` in `permissions.ts:54`), checked exactly like `assignment.update` via `requirePermission(projectId, "project.manage_members")` (`apps/web/lib/auth/rbac.ts:7`).
- Consumed by: Task 10 (Settings tab member-management gate).

- [ ] **Step 1: Write the migration**

```sql
-- 0045_project_manage_members_permission.sql
-- docs/11-codex/984 "Granting access": fixes a dangling promise already in
-- project/page.tsx's SettingsView — the "เพิ่ม/จัดการผู้ใช้" link points at
-- /superadmin/users, which a project_manager viewing their own project could
-- never open.

insert into public.permissions (permission_key, permission_name, description) values
  ('project.manage_members', 'Manage project members', 'Add, remove, or change the role of a member on a specific project.')
on conflict (permission_key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.role_key = 'project_manager' and p.permission_key = 'project.manage_members'
on conflict (role_id, permission_id) do nothing;
```

- [ ] **Step 2: Write the failing test**

```typescript
// apps/web/lib/auth/permissions.test.ts
import { describe, expect, it } from "vitest";
import { roleHasPermission } from "./permissions";

describe("project.manage_members", () => {
  it("is granted to project_manager", () => {
    expect(roleHasPermission("project_manager", "project.manage_members")).toBe(true);
  });

  it("is not granted to dispatcher", () => {
    expect(roleHasPermission("dispatcher", "project.manage_members")).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -w @tomp/web -- apps/web/lib/auth/permissions.test.ts`
Expected: FAIL — `project_manager`'s array in `ROLE_PERMISSIONS` does not yet contain `"project.manage_members"`.

- [ ] **Step 4: Add the permission to the fallback matrix**

In `apps/web/lib/auth/permissions.ts`, inside the `project_manager` array (line 12-32), add `"project.manage_members"` after `"change.apply"`:

```typescript
  project_manager: [
    "project.read",
    "project.create",
    "project.update",
    "project.publish",
    "project.delete",
    "mission.read",
    "mission.create",
    "assignment.read",
    "assignment.create",
    "assignment.update",
    "driver.read",
    "driver.create",
    "vehicle.read",
    "vehicle.create",
    "timeline.read",
    "timeline.create",
    "change.create",
    "change.approve",
    "change.apply",
    "project.manage_members"
  ],
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -w @tomp/web -- apps/web/lib/auth/permissions.test.ts`
Expected: PASS.

- [ ] **Step 6: Apply and mirror the migration**

Run: `node scripts/apply-migrations.mjs --dry-run` then `node scripts/apply-migrations.mjs`
Run: `node scripts/sync-supabase-migrations.mjs`

- [ ] **Step 7: Commit**

```bash
git add database/migrations/0045_project_manage_members_permission.sql supabase/migrations/0045_project_manage_members_permission.sql apps/web/lib/auth/permissions.ts apps/web/lib/auth/permissions.test.ts
git commit -m "Add project.manage_members permission, granted to project_manager"
```

---

## Part 2 — Access logic

### Task 4: Layer 3 — task-ownership enforcement in Airport Transfer's checklist

**Files:**
- Create: `apps/web/lib/airport-transfer/project-role.ts`
- Create: `apps/web/lib/airport-transfer/project-role.test.ts`
- Modify: `apps/web/app/airport-transfer/actions.ts:691-760` (`completeAirportTransferTask`)

**Interfaces:**
- Produces: `getAirportTransferProjectRole(projectId: string, profileId: string): Promise<string | null>` — the profile's `role_key` from `project_members` where `system_key = 'airport_transfer'` and `project_id` matches, or `null` if no such row.
- Consumes: `getSupabaseServerDataClient` from `@/lib/supabase/server` (existing).
- Consumed by: `completeAirportTransferTask` (this task), Task 5 (Airport Transfer's project-scoped access check reuses the same lookup pattern).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/lib/airport-transfer/project-role.test.ts
import { describe, expect, it, vi } from "vitest";
import { getAirportTransferProjectRole } from "./project-role";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerDataClient: vi.fn()
}));

import { getSupabaseServerDataClient } from "@/lib/supabase/server";

describe("getAirportTransferProjectRole", () => {
  it("returns the role_key for that project + system", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { roles: { role_key: "airport_driver" } } });
    const chain = { select: () => chain, eq: () => chain, maybeSingle };
    (getSupabaseServerDataClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: () => chain });

    const role = await getAirportTransferProjectRole("project-1", "profile-1");
    expect(role).toBe("airport_driver");
  });

  it("returns null when there is no membership row", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const chain = { select: () => chain, eq: () => chain, maybeSingle };
    (getSupabaseServerDataClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: () => chain });

    const role = await getAirportTransferProjectRole("project-1", "profile-1");
    expect(role).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w @tomp/web -- apps/web/lib/airport-transfer/project-role.test.ts`
Expected: FAIL — `./project-role` does not exist yet.

- [ ] **Step 3: Implement**

```typescript
// apps/web/lib/airport-transfer/project-role.ts
import "server-only";

import { getSupabaseServerDataClient } from "@/lib/supabase/server";

/**
 * The profile's Airport Transfer role on this specific project — from the
 * same project_members table Ground Transfer roles already live in, scoped
 * by system_key. Null when the profile holds no Airport Transfer role on
 * this project (they may still hold one on a different project).
 */
export async function getAirportTransferProjectRole(projectId: string, profileId: string): Promise<string | null> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("project_members")
    .select("roles(role_key)")
    .eq("project_id", projectId)
    .eq("profile_id", profileId)
    .eq("system_key", "airport_transfer")
    .eq("status", "active")
    .maybeSingle();

  const roles = data?.roles as { role_key?: string } | { role_key?: string }[] | null;
  const roleKey = Array.isArray(roles) ? roles[0]?.role_key : roles?.role_key;
  return roleKey ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w @tomp/web -- apps/web/lib/airport-transfer/project-role.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the check into `completeAirportTransferTask`**

In `apps/web/app/airport-transfer/actions.ts`, the function currently gates only on `access.canManage` (line 696: `if (!access.allowed || !access.canManage) return;`), so `airport_coordinator`/`airport_driver`/`airport_viewer` can never complete anything and `owner_role` (already written at case creation, `taskTemplate()` line 110-132) is never read. Replace lines 691-722 with:

```typescript
export async function completeAirportTransferTask(caseId: string, taskId: string) {
  const validId = z.string().uuid();
  if (!validId.safeParse(caseId).success || !validId.safeParse(taskId).success) return;

  const access = await getAirportTransferAccess();
  if (!access.allowed) return;
  const profile = await getCurrentUserProfile();
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return;

  const { data: activeCase } = await supabase
    .from("airport_transfer_cases")
    .select("operational_status, deleted_at, project_id")
    .eq("id", caseId)
    .maybeSingle();
  if (!activeCase || activeCase.deleted_at || activeCase.operational_status === "cancelled") return;

  const { data: task } = await supabase
    .from("airport_transfer_tasks")
    .select("id, task_key, status, sequence, owner_role")
    .eq("id", taskId)
    .eq("case_id", caseId)
    .maybeSingle();
  if (!task || task.status === "completed") return;

  // Layer 3 (docs/11-codex/984): admin/dispatcher keep doing everything,
  // unchanged. Everyone else may only complete the step labelled as their
  // own duty, on the project this case actually belongs to.
  if (!access.canManage) {
    const projectRole = activeCase.project_id
      ? await getAirportTransferProjectRole(String(activeCase.project_id), profile.id)
      : null;
    if (projectRole !== task.owner_role) return;
  }

  const { count: unfinishedEarlierTasks } = await supabase
    .from("airport_transfer_tasks")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .lt("sequence", task.sequence)
    .eq("status", "pending");
  if (unfinishedEarlierTasks) return;
```

(The rest of the function, from `const completedAt = new Date().toISOString();` onward, is unchanged.) Add the import at the top of the file:

```typescript
import { getAirportTransferProjectRole } from "@/lib/airport-transfer/project-role";
```

- [ ] **Step 6: Run the full test suite for this file's neighborhood**

Run: `npm run test -w @tomp/web -- apps/web/lib/airport-transfer`
Expected: PASS (no existing test currently covers `completeAirportTransferTask` directly — this step only confirms nothing else in the directory broke).

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/airport-transfer/project-role.ts apps/web/lib/airport-transfer/project-role.test.ts apps/web/app/airport-transfer/actions.ts
git commit -m "Enforce Layer 3 task ownership: a driver/coordinator may only complete their own duty"
```

---

### Task 5: `getAirportTransferAccess()` becomes project-scoped

**Files:**
- Modify: `apps/web/lib/airport-transfer/access.ts` (full rewrite of the exported function's signature and body)
- Modify: `apps/web/app/airport-transfer/actions.ts` (every call site of `getAirportTransferAccess()`, plus `createAirportTransferCase`'s schema and insert)
- Modify: `apps/web/app/airport-transfer/layout.tsx`
- Modify: `apps/web/components/airport-transfer/create-case-form.tsx` (add a project selector)
- Test: `apps/web/lib/airport-transfer/access.test.ts` (new file)

**Interfaces:**
- Produces: `getAirportTransferAccess(projectId?: string): Promise<AirportTransferAccess>` — when `projectId` is given, `role`/`canManage`/`allowed` come from `getAirportTransferProjectRole(projectId, profile.id)` (Task 4) instead of the retired flat `airport_transfer_memberships` table; when omitted, `allowed` answers "does this profile hold *any* active Airport Transfer project_members row anywhere" (used only by the layout's account-level gate and the landing page in Task 12), and `canManage`/`role` are `false`/`null` in that mode since neither means anything without a project.
- Breaking change, deliberately: every existing caller of `getAirportTransferAccess()` with no argument that expected `canManage` to work (every action in `actions.ts` except the account-level layout gate) must now pass the case's `project_id`. This task updates all of them in the same commit — an unscoped call left over anywhere is a silent authorization bug, not a style issue.
- Consumed by: Task 8 (Airport Transfer's pages, once moved under `/projects/[projectCode]/airport-transfer`, will pass the resolved project id from the route).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/lib/airport-transfer/access.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/access", () => ({
  getViewerAccess: vi.fn().mockResolvedValue({
    profile: { authUserId: "auth-1", isDevelopmentFallback: false, id: "profile-1" },
    roleKeys: []
  })
}));
vi.mock("@/lib/airport-transfer/project-role", () => ({
  getAirportTransferProjectRole: vi.fn()
}));

import { getAirportTransferAccess } from "./access";
import { getAirportTransferProjectRole } from "./project-role";

describe("getAirportTransferAccess(projectId)", () => {
  it("grants canManage for airport_admin on the given project", async () => {
    (getAirportTransferProjectRole as ReturnType<typeof vi.fn>).mockResolvedValue("airport_admin");
    const access = await getAirportTransferAccess("project-1");
    expect(access).toMatchObject({ allowed: true, canManage: true, role: "airport_admin" });
  });

  it("denies canManage for airport_driver on the given project", async () => {
    (getAirportTransferProjectRole as ReturnType<typeof vi.fn>).mockResolvedValue("airport_driver");
    const access = await getAirportTransferAccess("project-1");
    expect(access).toMatchObject({ allowed: true, canManage: false, role: "airport_driver" });
  });

  it("denies access when the profile holds no role on this project", async () => {
    (getAirportTransferProjectRole as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const access = await getAirportTransferAccess("project-1");
    expect(access).toMatchObject({ allowed: false, canManage: false, role: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w @tomp/web -- apps/web/lib/airport-transfer/access.test.ts`
Expected: FAIL — the current function ignores any argument and reads `airport_transfer_memberships`, so the mocked `getAirportTransferProjectRole` is never called.

- [ ] **Step 3: Rewrite `access.ts`**

```typescript
// apps/web/lib/airport-transfer/access.ts
import "server-only";

import { cache } from "react";
import { getViewerAccess } from "@/lib/auth/access";
import { getAirportTransferProjectRole } from "@/lib/airport-transfer/project-role";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

export type AirportTransferRole = "airport_admin" | "airport_dispatcher" | "airport_coordinator" | "airport_driver" | "airport_viewer";

export interface AirportTransferAccess {
  allowed: boolean;
  canManage: boolean;
  role: AirportTransferRole | "super_admin" | "development" | null;
  profileId: string;
  signedIn: boolean;
}

/**
 * Airport Transfer access, scoped to one project (docs/11-codex/984 Layer 2):
 * a profile's role now comes from project_members + system_key, the same
 * table Ground Transfer roles already use — not the flat, disconnected
 * airport_transfer_memberships table, which this retires.
 *
 * Called with no projectId, this only answers "does this account hold
 * Airport Transfer access on *some* project" — canManage/role are meaningless
 * without a project, so they come back false/null. That form exists only for
 * the account-level layout gate and the landing page tile.
 */
export const getAirportTransferAccess = cache(async function getAirportTransferAccess(projectId?: string): Promise<AirportTransferAccess> {
  const viewer = await getViewerAccess();
  const signedIn = Boolean(viewer.profile.authUserId) || viewer.profile.isDevelopmentFallback;

  if (viewer.profile.isDevelopmentFallback) {
    return { allowed: true, canManage: true, role: "development", profileId: viewer.profile.id, signedIn: true };
  }

  if (!signedIn) {
    return { allowed: false, canManage: false, role: null, profileId: viewer.profile.id, signedIn: false };
  }

  if (viewer.roleKeys.includes("super_admin")) {
    return { allowed: true, canManage: true, role: "super_admin", profileId: viewer.profile.id, signedIn: true };
  }

  if (projectId) {
    const role = (await getAirportTransferProjectRole(projectId, viewer.profile.id)) as AirportTransferRole | null;
    return {
      allowed: Boolean(role),
      canManage: role === "airport_admin" || role === "airport_dispatcher",
      role,
      profileId: viewer.profile.id,
      signedIn: true
    };
  }

  const supabase = getSupabaseServerDataClient();
  if (!supabase) return { allowed: false, canManage: false, role: null, profileId: viewer.profile.id, signedIn: true };

  const { data } = await supabase
    .from("project_members")
    .select("id")
    .eq("profile_id", viewer.profile.id)
    .eq("system_key", "airport_transfer")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return { allowed: Boolean(data), canManage: false, role: null, profileId: viewer.profile.id, signedIn: true };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w @tomp/web -- apps/web/lib/airport-transfer/access.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `layout.tsx` to use the account-level (no-argument) form explicitly**

`apps/web/app/airport-transfer/layout.tsx` is being retired in Task 8 in favour of a project-scoped layout, but until that task lands, keep it working:

```typescript
export default async function AirportTransferLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [access, profile] = await Promise.all([getAirportTransferAccess(), getCurrentUserProfile()]);
  if (!access.signedIn) redirect("/login?next=/airport-transfer");
  if (!access.allowed) redirect("/no-access?module=airport-transfer");
  return <AirportTransferShell userName={profile.fullName} roleLabel={access.role || "airport_transfer"}>{children}</AirportTransferShell>;
}
```

No change to this file's body is needed in this task — `getAirportTransferAccess()` called with no argument already does the right thing after Step 3. This step is verification only: confirm the file still compiles against the new signature.

Run: `npm run typecheck -w @tomp/web`
Expected: no new errors from `airport-transfer/layout.tsx`.

- [ ] **Step 6: Add a required project selector to case creation**

`apps/web/lib/airport-transfer/actions.ts`'s `createCaseSchema` (line 55-87) has no `projectId` field, and `createAirportTransferCase`'s insert (line 260-300) never sets one — so every new case would still get `project_id = null` even after Task 2's migration. Add the field:

In `createCaseSchema` (after `direction`):
```typescript
  projectId: z.string().uuid("กรุณาเลือกโครงการ"),
```

In `createAirportTransferCase`, replace the access check (line 191-192):
```typescript
export async function createAirportTransferCase(_previous: CreateTransferCaseState, formData: FormData): Promise<CreateTransferCaseState> {
  const projectIdRaw = String(formData.get("projectId") || "");
  const access = projectIdRaw ? await getAirportTransferAccess(projectIdRaw) : await getAirportTransferAccess();
  if (!access.allowed || !access.canManage) return { ok: false, message: "บัญชีนี้ไม่มีสิทธิ์สร้างเคส Airport Transfer" };
```

Add `projectId: formData.get("projectId")` to the `createCaseSchema.safeParse({...})` call's input object (after `direction`), and add `project_id: input.projectId` to the `airport_transfer_cases` insert payload (after `organization_id: profile.organizationId,`).

Do the same for `updateAirportTransferCase` (it does not change a case's project, so no schema field is needed there — but its access check at line 342-343 must become project-scoped: read `current.project_id` after the existing lookup at line 390, then re-check `getAirportTransferAccess(String(current.project_id))` before proceeding, replacing the unscoped check at the top of the function since the project is not known until after that read).

Update the remaining call sites the same way — each already reads the case row before acting, so pass its `project_id`:
- `refreshAirportTransferFlight` (line 499-500): move the access check after the `current` read (line 504), pass `String(current.project_id)`.
- `cancelAirportTransferCase` (line 614-615): move after the `current` read (line 621), which must additionally select `project_id`.
- `trashAirportTransferCase` (line 641-642): this one deletes before reading the case's current state — add a read of `project_id` first, then check access.
- `restoreAirportTransferCase` (line 661-662): same pattern — read `project_id` first.
- `runAirportTransferFlightSync` (line 603-604): this syncs *all* active cases across every project, not one case — leave this call unscoped (`getAirportTransferAccess()` with no argument only confirms account-level access) but restrict it to `access.canManage` being true for **at least one** project; since that "at least one" check doesn't exist yet, gate this action on `viewer.roleKeys.includes("super_admin")` OR any active `airport_admin`/`airport_dispatcher` project_members row for this profile — reuse the account-level query already added to `access.ts` Step 3, but check the joined `roles.role_key` instead of just existence:

```typescript
export async function runAirportTransferFlightSync(_previous: RefreshFlightState): Promise<RefreshFlightState> {
  void _previous;
  const access = await getAirportTransferAccess();
  if (!access.allowed) return { ok: false, message: "บัญชีนี้ไม่มีสิทธิ์สั่งตรวจข้อมูลเที่ยวบิน" };
  if (access.role !== "super_admin" && access.role !== "development") {
    const supabase = getSupabaseServerDataClient();
    const profile = await getCurrentUserProfile();
    const { data } = await supabase
      ?.from("project_members")
      .select("roles(role_key)")
      .eq("profile_id", profile.id)
      .eq("system_key", "airport_transfer")
      .eq("status", "active") ?? { data: null };
    const canManageAnyProject = (data ?? []).some((row) => {
      const roles = row.roles as { role_key?: string } | { role_key?: string }[] | null;
      const roleKey = Array.isArray(roles) ? roles[0]?.role_key : roles?.role_key;
      return roleKey === "airport_admin" || roleKey === "airport_dispatcher";
    });
    if (!canManageAnyProject) return { ok: false, message: "บัญชีนี้ไม่มีสิทธิ์สั่งตรวจข้อมูลเที่ยวบิน" };
  }
  const result = await syncActiveAirportTransferFlights();
  revalidatePath("/airport-transfer");
  revalidatePath("/airport-transfer/cases");
  return { ok: result.ok, message: result.message };
}
```

- [ ] **Step 7: Add a project selector to the create-case form UI**

`apps/web/components/airport-transfer/create-case-form.tsx` currently has no project field. Read the file to find its existing field-rendering pattern (it follows the same `<label>`/`<select>` or `<input>` shape as the other fields in `createCaseSchema`), and add a required `<select name="projectId">` populated from the projects the current profile holds an `airport_transfer` `project_members` row on (fetch via a new small helper `getAirportTransferProjectOptions()` in `apps/web/lib/airport-transfer/data.ts`, following the existing `resolveReadClient()` pattern already used elsewhere in that file — select `project_id, projects(project_code, project_name)` from `project_members` where `system_key = 'airport_transfer'` and `profile_id` = the current profile and `status = 'active'`). Place it as the first field, before `direction`, since every other field on the form belongs to a case that belongs to a project.

- [ ] **Step 8: Run the full Airport Transfer test suite**

Run: `npm run test -w @tomp/web -- apps/web/lib/airport-transfer apps/web/app/airport-transfer`
Expected: PASS.

Run: `npm run typecheck -w @tomp/web`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/airport-transfer/access.ts apps/web/lib/airport-transfer/access.test.ts apps/web/app/airport-transfer/actions.ts apps/web/components/airport-transfer/create-case-form.tsx apps/web/lib/airport-transfer/data.ts
git commit -m "Make Airport Transfer access project-scoped; require a project on every new case"
```

---

## Part 3 — URL restructure

### Task 6: Move Ground Transfer's public token pages under `/ground-transfer/**`

**Files:**
- Move: `apps/web/app/driver/page.tsx` → `apps/web/app/ground-transfer/driver/page.tsx`
- Move: `apps/web/app/driver/[token]/page.tsx` → `apps/web/app/ground-transfer/driver/[token]/page.tsx`
- Move: `apps/web/app/driver/layout.tsx` → `apps/web/app/ground-transfer/driver/layout.tsx`
- Move: `apps/web/app/fleet/[token]/page.tsx` → `apps/web/app/ground-transfer/fleet/[token]/page.tsx`
- Move: `apps/web/app/track/[token]/page.tsx` → `apps/web/app/ground-transfer/track/[token]/page.tsx`
- Modify: `apps/web/lib/driver-access/url.ts`
- Modify: `apps/web/lib/data/observer-access.ts` (fleet/track URL builders, if present — confirm during Step 3)
- Modify: `apps/web/lib/auth/public-paths.ts`
- Modify: `apps/web/lib/auth/public-paths.test.ts`
- Modify: `apps/web/lib/driver-access/__tests__/url.test.ts`

**Interfaces:**
- Produces: `buildDriverAccessUrl(token, baseUrl?)` now returns `${baseUrl}/ground-transfer/driver?token=${token}` instead of `${baseUrl}/driver?token=${token}`.
- Breaking, deliberate, no redirect kept: `apps/mobile-driver/src/config.ts:32`'s `buildDriverWebUrl()` (`${TOMP_WEB_ORIGIN}/driver/${token}?...`) must change to `${TOMP_WEB_ORIGIN}/ground-transfer/driver/${token}?...` in the **same deploy** this ships in — flagged here, not implemented here, per the Global Constraints note (mobile is a separate agent's file).

- [ ] **Step 1: Move the files**

```bash
mkdir -p apps/web/app/ground-transfer/driver apps/web/app/ground-transfer/fleet apps/web/app/ground-transfer/track
git mv apps/web/app/driver/page.tsx apps/web/app/ground-transfer/driver/page.tsx
git mv "apps/web/app/driver/[token]/page.tsx" "apps/web/app/ground-transfer/driver/[token]/page.tsx"
git mv apps/web/app/driver/layout.tsx apps/web/app/ground-transfer/driver/layout.tsx
git mv "apps/web/app/fleet/[token]/page.tsx" "apps/web/app/ground-transfer/fleet/[token]/page.tsx"
git mv "apps/web/app/track/[token]/page.tsx" "apps/web/app/ground-transfer/track/[token]/page.tsx"
```

None of these five files' own contents reference their own path (confirmed by the earlier read of all five — the redirector at `driver/[token]/page.tsx` builds `/driver?${query}` as a literal string, which is the one line that must change).

- [ ] **Step 2: Fix the one hardcoded path in the moved redirector**

In `apps/web/app/ground-transfer/driver/[token]/page.tsx`, line 21:

```typescript
  redirect(`/ground-transfer/driver?${query.toString()}`);
```

- [ ] **Step 3: Check `observer-access.ts` for a fleet/track URL builder**

Run: `grep -n "function build.*Url\|/fleet\|/track" apps/web/lib/data/observer-access.ts`
If a builder function exists there that hardcodes `/fleet` or `/track`, update it to `/ground-transfer/fleet` / `/ground-transfer/track` the same way Step 4 updates `buildDriverAccessUrl`. If no such builder exists (URLs are constructed inline at each call site instead), grep the whole `apps/web` tree for the literal strings `` `/fleet/${ `` and `` `/track/${ `` and update every call site found.

- [ ] **Step 4: Update `buildDriverAccessUrl`**

```typescript
// apps/web/lib/driver-access/url.ts
export function buildDriverAccessUrl(token: string, baseUrl = getFallbackBaseUrl()): string {
  return `${baseUrl.replace(/\/$/, "")}/ground-transfer/driver?token=${encodeURIComponent(token)}`;
}
```

- [ ] **Step 5: Update the existing tests to match**

```typescript
// apps/web/lib/driver-access/__tests__/url.test.ts
describe("driver access URL", () => {
  it("builds a driver token URL", () => {
    expect(buildDriverAccessUrl("token-1", "https://tomp.example")).toBe("https://tomp.example/ground-transfer/driver?token=token-1");
  });
});
```

```typescript
// apps/web/lib/auth/public-paths.test.ts
describe("public path guard", () => {
  it("allows public customer and driver entry routes intentionally", () => {
    expect(isPublicPath("/ground-transfer/driver/abc")).toBe(true);
    expect(isPublicPath("/ground-transfer/fleet/abc")).toBe(true);
    expect(isPublicPath("/ground-transfer/track/abc")).toBe(true);
  });

  it("keeps protected app routes protected and respects path boundaries", () => {
    expect(isPublicPath("/projects")).toBe(false);
    expect(isPublicPath("/mission-control")).toBe(false);
    expect(isPublicPath("/fleetwise")).toBe(false);
  });
});
```

- [ ] **Step 6: Update the public-path allowlist**

```typescript
// apps/web/lib/auth/public-paths.ts
export const PUBLIC_PREFIXES = [
  "/login",
  "/no-access",
  "/auth/callback",
  "/ground-transfer/driver",
  "/api/driver",
  "/api/health",
  "/ground-transfer/fleet",
  "/ground-transfer/track",
  "/_next",
  "/favicon.ico"
] as const;
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test -w @tomp/web -- apps/web/lib/driver-access apps/web/lib/auth/public-paths.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A apps/web/app/driver apps/web/app/fleet apps/web/app/track apps/web/app/ground-transfer apps/web/lib/driver-access/url.ts apps/web/lib/auth/public-paths.ts apps/web/lib/auth/public-paths.test.ts apps/web/lib/driver-access/__tests__/url.test.ts apps/web/lib/data/observer-access.ts
git commit -m "Move driver/fleet/track token pages under /ground-transfer (984 URL structure)"
```

---

### Task 7: Introduce `/projects/[projectCode]/ground-transfer/**`; retire the bare TOMP paths

**Files:**
- Modify: `apps/web/lib/data/projects.ts` (add `getProjectByCode`)
- Create: `apps/web/app/(app)/projects/[projectCode]/ground-transfer/layout.tsx`
- Move+adapt: `apps/web/app/(app)/project/page.tsx` → `apps/web/app/(app)/projects/[projectCode]/ground-transfer/page.tsx` (overview; `SettingsView` is extracted out in Task 10, not moved here)
- Move+adapt: `apps/web/app/(app)/assignments/page.tsx` → `apps/web/app/(app)/projects/[projectCode]/ground-transfer/dispatch/page.tsx`
- Move+adapt: `apps/web/app/(app)/mission-control/page.tsx` → `apps/web/app/(app)/projects/[projectCode]/ground-transfer/control/page.tsx`
- Split: `apps/web/app/(app)/resources/page.tsx` — the `projectId` branch (lines 36-118) moves to a new `apps/web/app/(app)/projects/[projectCode]/ground-transfer/resources/page.tsx`; the library branch (lines 120-153) stays at `apps/web/app/(app)/resources/page.tsx` with the `projectId`-handling code deleted (the global library is not a project-scoped page — see the note below)
- Move: `apps/web/app/(app)/recovery/page.tsx` → `apps/web/app/(app)/ground-transfer/recovery/page.tsx` (see note)
- Delete: `apps/web/app/(app)/projects/[projectId]/page.tsx`, `apps/web/app/(app)/projects/[projectId]/assignments/page.tsx`, `apps/web/app/(app)/project/page.tsx` (folder), `apps/web/app/(app)/assignments/page.tsx`, `apps/web/app/(app)/mission-control/page.tsx`
- Modify: `apps/web/components/projects/project-workspace-tabs.tsx`

**Note on `/resources` and `/recovery` — a correction to `984`'s literal URL list:** `984` lists `/resources` and `/recovery` among "the old bare TOMP paths... simply gone." Reading both pages shows this is not quite right for either: `resources/page.tsx` is genuinely dual-purpose in one file — bare `/resources` renders the cross-project driver/vehicle *library* (`getDrivers()`/`getVehicles()`, no project involved), and only `?projectId=` renders a project's own copies. The library half stays exactly where it is; only the project-scoped half moves. `recovery/page.tsx` is not project-scoped at all — it lists incidents across *every* visible project at once (`getVisibleProjects()`, one `IncidentForm` covering all of them) — so it cannot sensibly live under one project's code prefix. It moves to `/ground-transfer/recovery` instead: a system-wide, non-project page, the same category `984` already uses for `/ground-transfer/superadmin/dev-tools/**`.

**Interfaces:**
- Produces: `getProjectByCode(projectCode: string): Promise<Project | null>` in `apps/web/lib/data/projects.ts`, following the exact pattern of the existing `getProjectById` (line 49-60) — Supabase-first with a `getPostgresClient()` fallback.
- Produces: a `ground-transfer` layout at `apps/web/app/(app)/projects/[projectCode]/ground-transfer/layout.tsx` that resolves the project once (via `getProjectByCode`) and passes `{ project }` to its children via a shared React context, so the four pages under it don't each re-resolve it.
- Consumes: `ProjectWorkspaceTabs` (rewritten in this task to take `projectCode` instead of `projectId` and emit the new hrefs).
- Consumed by: Task 9 (the outer three-tab shell wraps this layout's output), Task 10 (extracts `SettingsView` out of the old `project/page.tsx` into the shared Settings tab).

- [ ] **Step 1: Add `getProjectByCode`**

```typescript
// apps/web/lib/data/projects.ts — add after getProjectById (line 60)
export async function getProjectByCode(projectCode: string): Promise<Project | null> {
  const { client: supabase } = await resolveReadClient();
  if (!supabase) return getProjectByCodeViaPostgres(projectCode);

  try {
    const { data, error } = await withTimeout(supabase.from("projects").select("*").eq("project_code", projectCode).maybeSingle(), 2200, "project detail by code");
    if (error || !data) return getProjectByCodeViaPostgres(projectCode);
    return mapProject(data);
  } catch {
    return getProjectByCodeViaPostgres(projectCode);
  }
}

async function getProjectByCodeViaPostgres(projectCode: string): Promise<Project | null> {
  const sql = getPostgresClient();
  if (!sql) return demoOr(demoKernel.projects.find((project) => project.projectCode === projectCode) ?? null, null);
  try {
    const data = await sql<Array<Record<string, unknown>>>`select * from projects where project_code = ${projectCode} limit 1`;
    if (data[0]) return mapProject(data[0]);
    return demoOr(demoKernel.projects.find((project) => project.projectCode === projectCode) ?? null, null);
  } catch {
    return demoOr(demoKernel.projects.find((project) => project.projectCode === projectCode) ?? null, null);
  }
}
```

- [ ] **Step 2: Write a test for the new lookup**

```typescript
// apps/web/lib/data/projects.test.ts (new file, or append if one exists — check first with: find apps/web/lib/data -iname "projects.test.ts")
import { describe, expect, it } from "vitest";
import { getProjectByCode } from "./projects";

describe("getProjectByCode", () => {
  it("returns null for a code that matches nothing", async () => {
    const project = await getProjectByCode("NO-SUCH-CODE-EXISTS-0000");
    expect(project).toBeNull();
  });
});
```

Run: `npm run test -w @tomp/web -- apps/web/lib/data/projects.test.ts`
Expected: PASS (this only exercises the not-found path, which needs no live database — both the Supabase and Postgres branches return `null`/the demo-kernel fallback for an unmatched code).

- [ ] **Step 3: Create the ground-transfer layout**

```typescript
// apps/web/app/(app)/projects/[projectCode]/ground-transfer/layout.tsx
import { notFound } from "next/navigation";
import { getProjectByCode } from "@/lib/data/projects";

export default async function GroundTransferProjectLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ projectCode: string }>;
}) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();
  return children;
}
```

(Each page below still calls `getProjectByCode` itself to get a typed `project` in scope — Next.js layouts cannot hand data to page components directly. This layout's only job is the 404 short-circuit for an unknown code before any page-specific data fetching runs.)

- [ ] **Step 4: Move and adapt the overview page**

```bash
git mv "apps/web/app/(app)/project/page.tsx" "apps/web/app/(app)/projects/[projectCode]/ground-transfer/page.tsx"
```

In the moved file, replace the `ProjectPageProps`/default export (lines 31-89 of the original) — drop the `?tab=settings` branch entirely (Settings moves to Task 10's shared tab) and switch from `searchParams.projectId` to `params.projectCode`:

```typescript
interface GroundTransferOverviewPageProps {
  params: Promise<{ projectCode: string }>;
}

export default async function GroundTransferOverviewPage({ params }: GroundTransferOverviewPageProps) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) {
    return (
      <AccessDenied
        title="เข้าโครงการนี้ไม่ได้"
        reason="โครงการนี้ไม่มีอยู่ หรือคุณยังไม่ได้เป็นสมาชิก ติดต่อผู้จัดการโครงการเพื่อขอสิทธิ์เข้าใช้งาน"
      />
    );
  }

  return (
    <div className="grid gap-4">
      <ProjectWorkspaceTabs projectCode={project.projectCode} active="overview" />

      <section className="enterprise-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-operation">{project.projectCode}</p>
            <h1 className="mt-1 text-xl font-bold text-ink">{project.projectName}</h1>
            <p className="mt-1 text-sm text-slate-600">{project.startDate} – {project.endDate} · {project.timezone}</p>
          </div>
          <StatusBadge label={formatStatusTh(project.status)} tone={project.status === "published" || project.status === "operating" ? "ready" : "neutral"} />
        </div>
      </section>

      <OverviewView projectId={project.id} />
    </div>
  );
}
```

Delete the `SettingsView` function from this file entirely (it moves to Task 10) along with its now-unused imports (`getProjectMembers`, `checkProjectPublishReadiness`, `resolveCoordinatorPhone`/`resolveOperationPhone`, `roleLabelTh`, `ProjectDetailsForm`, `ProjectContactForm`, `ProjectPublishPanel`, `ProjectArchiveButton`, `ProjectDeletePanel`) — keep `OverviewView` and its own imports (`ProjectOperationSummaryPanel`, `ProjectMissionBoard`, `ProjectChangePanel`, `CollapsibleSection`, `getMissionsByProjectId`, `getCallSignsByProjectId`, `getProjectVehicles`/`getProjectDrivers`, `getLatestDriverLocationsByProjectId`, `combineResults`, `DataUnavailable`, `summariseProjectOperation`) unchanged, and add `getProjectByCode` to the imports.

- [ ] **Step 5: Move and adapt the dispatch (assignments) page**

```bash
mkdir -p "apps/web/app/(app)/projects/[projectCode]/ground-transfer/dispatch"
git mv "apps/web/app/(app)/assignments/page.tsx" "apps/web/app/(app)/projects/[projectCode]/ground-transfer/dispatch/page.tsx"
```

Replace the `AssignmentsPageProps`/function signature (original lines 19-29): drop the `getVisibleProjects()`-empty-state branch (unreachable now — the layout in Step 3 already 404s an unknown project, and this page only renders once a project is confirmed to exist) and resolve by code:

```typescript
interface DispatchPageProps {
  params: Promise<{ projectCode: string }>;
}

export default async function DispatchPage({ params }: DispatchPageProps) {
  const { projectCode } = await params;
  const viewer = await getCurrentUserProfile();
  if (!viewer.authUserId && !viewer.isDevelopmentFallback) redirect("/login");
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();
  const projectId = project.id;
  // ... existing body from here on, unchanged — it already takes projectId
  // and never re-derives it from projects[0], so no further edits are needed
  // below this line.
```

Add `getProjectByCode` and `notFound` (`next/navigation`) to the imports; remove `getVisibleProjects` and `Link` if they become unused after deleting the empty-state branch (check with `npm run lint -w @tomp/web` in Step 9).

- [ ] **Step 6: Move and adapt the control (mission-control) page**

```bash
mkdir -p "apps/web/app/(app)/projects/[projectCode]/ground-transfer/control"
git mv "apps/web/app/(app)/mission-control/page.tsx" "apps/web/app/(app)/projects/[projectCode]/ground-transfer/control/page.tsx"
```

Apply the identical transformation as Step 5 (same shape: drop the empty-projects branch, resolve `projectId` from `getProjectByCode(projectCode)` via `params` instead of `searchParams`).

- [ ] **Step 7: Split the resources page**

Create the project-scoped half:

```bash
mkdir -p "apps/web/app/(app)/projects/[projectCode]/ground-transfer/resources"
```

```typescript
// apps/web/app/(app)/projects/[projectCode]/ground-transfer/resources/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CarFront, Library } from "lucide-react";
import { ProjectWorkspaceTabs } from "@/components/projects/project-workspace-tabs";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { CreateDriverForm } from "@/components/resources/create-driver-form";
import { CreateVehicleForm } from "@/components/resources/create-vehicle-form";
import { ProjectResourceManager } from "@/components/resources/project-resource-manager";
import { getProjectByCode } from "@/lib/data/projects";
import { getLibraryDrivers, getLibraryVehicles, getProjectDrivers, getProjectVehicles } from "@/lib/data/resources";

export default async function ProjectResourcesPage({ params }: { params: Promise<{ projectCode: string }> }) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();
  const projectId = project.id;

  const [drivers, vehicles, libraryDrivers, libraryVehicles] = await Promise.all([
    getProjectDrivers(projectId),
    getProjectVehicles(projectId),
    getLibraryDrivers(projectId),
    getLibraryVehicles(projectId)
  ]);

  return (
    <div className="grid gap-4">
      <ProjectWorkspaceTabs projectCode={project.projectCode} active="resources" />

      <section className="enterprise-panel-soft p-4">
        <h1 className="text-lg font-semibold text-ink">ทรัพยากรของโครงการนี้</h1>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          คนขับ {drivers.length} คน · รถ {vehicles.length} คัน — นำเข้าจากคลังกลางหรือเพิ่มใหม่ก็ได้
          แล้วไปจับคู่เป็นหน่วยรถที่เมนู “จัดงาน”
        </p>
      </section>

      {drivers.length === 0 && vehicles.length === 0 ? (
        <section className="enterprise-panel-soft border-teal-200 bg-teal-50/60 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-teal-900">
            <Library className="h-4 w-4" /> เริ่มต้นด้วยการนำเข้าทรัพยากร
          </p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-teal-900">
            โครงการเก็บคนขับและรถเป็นสำเนาของตัวเอง เพื่อให้สถานะและการแก้ไขไม่ข้ามไปโครงการอื่น
            โครงการนี้จึงยังว่างอยู่ — ไม่ใช่ข้อมูลหาย
            {libraryDrivers.length + libraryVehicles.length > 0 ? (
              <> ตอนนี้คลังกลางมีคนขับ {libraryDrivers.length} คน และรถ {libraryVehicles.length} คัน กด <span className="font-semibold">“นำเข้าจากคลังกลาง”</span> ด้านล่างเพื่อดึงเข้าโครงการนี้</>
            ) : (
              <> คลังกลางยังไม่มีรายการ เพิ่มคนขับและรถได้ที่ด้านล่าง หรือที่เมนู <Link href="/resources" className="font-semibold underline">ทรัพยากรกลาง</Link> เพื่อเก็บไว้ใช้ข้ามโครงการ</>
            )}
          </p>
        </section>
      ) : null}

      <ProjectResourceManager projectId={projectId} drivers={drivers} vehicles={vehicles} libraryDrivers={libraryDrivers} libraryVehicles={libraryVehicles} />

      <CollapsibleSection title="เพิ่มคนขับใหม่เข้าโครงการนี้" storageKey={`res.${projectId}.newdriver`} defaultOpen={drivers.length === 0}>
        <CreateDriverForm projectId={projectId} />
      </CollapsibleSection>

      <CollapsibleSection title="เพิ่มรถใหม่เข้าโครงการนี้" storageKey={`res.${projectId}.newvehicle`} defaultOpen={vehicles.length === 0}>
        <CreateVehicleForm projectId={projectId} />
      </CollapsibleSection>

      <Link className="smart-card group flex items-center justify-between gap-3 p-4" href={`/resources/vehicles?projectId=${encodeURIComponent(projectId)}`}>
        <span className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-ink-soft"><CarFront className="h-5 w-5" /></span>
          <span>
            <span className="block text-sm font-semibold text-ink">มุมมองปฏิบัติการของรถ</span>
            <span className="block text-xs text-ink-soft">แผนที่ตำแหน่งรถ คิวงาน และงานคงเหลือของแต่ละคัน</span>
          </span>
        </span>
        <ArrowRight className="h-5 w-5 text-ink-faint transition group-hover:translate-x-1 group-hover:text-operation" />
      </Link>
    </div>
  );
}
```

Then trim `apps/web/app/(app)/resources/page.tsx` to the library-only half — delete lines 28-118 (the `ResourcesPageProps` interface, the `projectId` destructure, and the entire `if (projectId) { ... }` block) so the file becomes:

```typescript
// apps/web/app/(app)/resources/page.tsx
import { Library } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { CreateDriverForm } from "@/components/resources/create-driver-form";
import { CreateVehicleForm } from "@/components/resources/create-vehicle-form";
import { ProjectResourceManager } from "@/components/resources/project-resource-manager";
import { getDrivers, getResourceUsage, getVehicles } from "@/lib/data/resources";

export default async function ResourcesPage() {
  const [drivers, vehicles, usage] = await Promise.all([getDrivers(), getVehicles(), getResourceUsage()]);

  return (
    <div className="grid gap-4">
      <section className="enterprise-panel-soft p-4">
        <p className="flex items-center gap-2 text-xs font-semibold text-operation">
          <Library className="h-4 w-4" /> ศูนย์รวมทรัพยากรกลาง
        </p>
        <h1 className="mt-1 text-lg font-semibold text-ink">คนขับและรถทั้งหมดขององค์กร</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
          ที่เก็บถาวรของคนขับ {drivers.length} คน และรถ {vehicles.length} คัน ใช้ข้ามโครงการได้
          เมื่อเปิดโครงการใหม่ ให้ <span className="font-semibold text-ink">นำเข้า</span> รายการจากที่นี่
          โครงการจะได้สำเนาของตัวเอง — แก้ไขหรือลบในโครงการไม่กระทบรายการต้นทางที่นี่
        </p>
      </section>

      <ProjectResourceManager projectId="" drivers={drivers} vehicles={vehicles} driverUsage={usage.drivers} vehicleUsage={usage.vehicles} />

      <CollapsibleSection title="เพิ่มคนขับเข้าคลังกลาง" storageKey="res.library.newdriver" defaultOpen={drivers.length === 0}>
        <CreateDriverForm />
      </CollapsibleSection>

      <CollapsibleSection title="เพิ่มรถเข้าคลังกลาง" storageKey="res.library.newvehicle" defaultOpen={vehicles.length === 0}>
        <CreateVehicleForm />
      </CollapsibleSection>
    </div>
  );
}
```

- [ ] **Step 8: Move `/recovery`**

```bash
mkdir -p "apps/web/app/(app)/ground-transfer/recovery"
git mv "apps/web/app/(app)/recovery/page.tsx" "apps/web/app/(app)/ground-transfer/recovery/page.tsx"
```

No internal changes needed — the file has no hardcoded self-reference. Only its inbound link changes: `apps/web/components/*` anywhere linking to `/recovery` (check with `grep -rn '"/recovery"' apps/web/components apps/web/app`) becomes `/ground-transfer/recovery`.

- [ ] **Step 9: Delete the now-superseded routes**

```bash
git rm -r "apps/web/app/(app)/projects/[projectId]"
```

(`apps/web/app/(app)/assignments`, `apps/web/app/(app)/mission-control`, and `apps/web/app/(app)/project` are already empty after the `git mv` calls in Steps 4-6 removed their only file — remove the now-empty directories: `rmdir "apps/web/app/(app)/assignments" "apps/web/app/(app)/mission-control" "apps/web/app/(app)/project"` if they linger, though `git mv` on a file's last entry typically leaves nothing to remove.)

- [ ] **Step 10: Rewrite `ProjectWorkspaceTabs`**

```typescript
// apps/web/components/projects/project-workspace-tabs.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ClipboardList, LayoutDashboard, MapPinned, Users } from "lucide-react";

type TabKey = "overview" | "dispatch" | "control" | "resources";

export function ProjectWorkspaceTabs({ projectCode, active }: { projectCode: string; active: TabKey }) {
  const pathname = usePathname();
  const base = `/projects/${projectCode}/ground-transfer`;

  const tabs: Array<{ key: TabKey; label: string; href: string; icon: typeof LayoutDashboard }> = [
    { key: "overview", label: "ภาพรวม", href: base, icon: LayoutDashboard },
    { key: "dispatch", label: "จัดงาน", href: `${base}/dispatch`, icon: ClipboardList },
    { key: "control", label: "ศูนย์ควบคุม", href: `${base}/control`, icon: MapPinned },
    { key: "resources", label: "ทรัพยากร", href: `${base}/resources`, icon: Users }
  ];

  const resolvedActive: TabKey = tabs.find((tab) => tab.href === pathname)?.key ?? active;

  return (
    <div className="grid gap-2">
      <Link href="/projects" className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-operation">
        <ArrowLeft className="h-3.5 w-3.5" /> โครงการทั้งหมด
      </Link>
      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-white p-1">
        {tabs.map((tab) => {
          const on = tab.key === resolvedActive;
          return (
            <Link key={tab.key} href={tab.href} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${on ? "bg-operation text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
```

The `Settings` tab is removed from this component entirely — it moves one level up, into Task 9's outer three-tab shell, which this component now sits inside rather than beside.

- [ ] **Step 11: Update `/projects/page.tsx`'s outbound links**

In `apps/web/app/(app)/projects/page.tsx` line 72, replace:
```typescript
                <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-operation px-3 py-1.5 text-xs font-semibold text-white">
```
with:
```typescript
                <Link href={`/projects/${project.projectCode}/ground-transfer`} className="inline-flex items-center gap-1.5 rounded-lg bg-operation px-3 py-1.5 text-xs font-semibold text-white">
```

- [ ] **Step 12: Typecheck, lint, and run the full test suite**

Run: `npm run typecheck -w @tomp/web`
Run: `npm run lint -w @tomp/web`
Run: `npm run test -w @tomp/web`
Expected: all clean — fix any now-unused import flagged by lint before committing.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "Move Ground Transfer's project pages under /projects/<code>/ground-transfer; retire bare paths"
```

---

### Task 8: Move Airport Transfer's pages under `/projects/[projectCode]/airport-transfer/**`

**Files:**
- Create: `apps/web/app/(app)/projects/[projectCode]/airport-transfer/layout.tsx`
- Move+adapt: `apps/web/app/airport-transfer/page.tsx` → `apps/web/app/(app)/projects/[projectCode]/airport-transfer/page.tsx`
- Move+adapt: `apps/web/app/airport-transfer/cases/page.tsx` → `apps/web/app/(app)/projects/[projectCode]/airport-transfer/cases/page.tsx`
- Move+adapt: `apps/web/app/airport-transfer/cases/new/page.tsx` → `.../airport-transfer/cases/new/page.tsx`
- Move+adapt: `apps/web/app/airport-transfer/cases/[caseId]/page.tsx` → `.../airport-transfer/cases/[caseId]/page.tsx`
- Move+adapt: `apps/web/app/airport-transfer/cases/[caseId]/edit/page.tsx` → `.../airport-transfer/cases/[caseId]/edit/page.tsx`
- Move+adapt: `apps/web/app/airport-transfer/imports/page.tsx` → `.../airport-transfer/imports/page.tsx`
- Move+adapt: `apps/web/app/airport-transfer/trash/page.tsx` → `.../airport-transfer/trash/page.tsx`
- Keep in place (system-wide, per `984`'s URL structure): `apps/web/app/airport-transfer/settings/page.tsx` stays at `/airport-transfer/settings` — it configures the AirLabs provider for the whole system, not one project.
- Delete: `apps/web/app/airport-transfer/layout.tsx` (replaced by the new project-scoped layout below); keep the `apps/web/app/airport-transfer/` directory itself, now holding only `settings/page.tsx` and a minimal layout for it.

**Interfaces:**
- Produces: an Airport Transfer layout resolving `{ projectCode }` → `project` (same `getProjectByCode` from Task 7) and passing `project.id` down; replaces the account-level `getAirportTransferAccess()` gate in the old `airport-transfer/layout.tsx` with the project-scoped form from Task 5: `getAirportTransferAccess(project.id)`.
- Consumes: `getProjectByCode` (Task 7), `getAirportTransferAccess(projectId)` (Task 5).

- [ ] **Step 1: Move the files**

```bash
mkdir -p "apps/web/app/(app)/projects/[projectCode]/airport-transfer"
git mv apps/web/app/airport-transfer/page.tsx "apps/web/app/(app)/projects/[projectCode]/airport-transfer/page.tsx"
git mv apps/web/app/airport-transfer/cases "apps/web/app/(app)/projects/[projectCode]/airport-transfer/cases"
git mv apps/web/app/airport-transfer/imports "apps/web/app/(app)/projects/[projectCode]/airport-transfer/imports"
git mv apps/web/app/airport-transfer/trash "apps/web/app/(app)/projects/[projectCode]/airport-transfer/trash"
git rm apps/web/app/airport-transfer/layout.tsx
```

**Correction found during Task 8's own review (not caught while writing this plan):** the layout code below originally wrapped the project-scoped pages in `AirportTransferShell` — copying the pre-move layout's behavior. That was wrong the moment these pages moved *inside* `(app)`: `(app)/layout.tsx` already supplies a full shell (`AppShell`/`WorkspaceShell`) to everything under it, so wrapping in `AirportTransferShell` too produced a doubled header and a `<main>` nested inside another `<main>`. `/airport-transfer/settings` stays *outside* `(app)` (it is genuinely system-wide, not project-scoped), so it still needs its own shell — the minimal layout below was wrong in the opposite direction, dropping chrome entirely. Fixed below to match the working precedent already set by `projects/[projectCode]/ground-transfer/layout.tsx` in Task 7 (`return children`, relying on `(app)`'s own shell).

`apps/web/app/airport-transfer/settings/page.tsx` and a small layout for it are left where they are — add a minimal `apps/web/app/airport-transfer/layout.tsx` guarding just that one page with the account-level (`super_admin`/`airport_admin`-anywhere) check, keeping the same `AirportTransferShell` chrome this page has always had (it is `/airport-transfer`'s only remaining page and sits outside `(app)`, so nothing else supplies a shell here):

```typescript
// apps/web/app/airport-transfer/layout.tsx (new, minimal — settings/ only)
import { redirect } from "next/navigation";
import { AirportTransferShell } from "@/components/airport-transfer/airport-transfer-shell";
import { getAirportTransferAccess } from "@/lib/airport-transfer/access";
import { getCurrentUserProfile } from "@/lib/auth/current-user";

export default async function AirportTransferSystemLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [access, profile] = await Promise.all([getAirportTransferAccess(), getCurrentUserProfile()]);
  if (!access.signedIn) redirect("/login?next=/airport-transfer/settings");
  if (!access.allowed) redirect("/no-access?module=airport-transfer");
  return <AirportTransferShell userName={profile.fullName} roleLabel={access.role || "airport_transfer"}>{children}</AirportTransferShell>;
}
```

- [ ] **Step 2: Create the project-scoped layout**

Unlike the settings layout above, this one does **not** wrap in `AirportTransferShell` — these pages live inside `(app)`, which already provides the shell (chrome comes from `(app)/layout.tsx` alone, exactly as `projects/[projectCode]/ground-transfer/layout.tsx` already does in Task 7). This layout's only job is the access gate.

```typescript
// apps/web/app/(app)/projects/[projectCode]/airport-transfer/layout.tsx
import { notFound, redirect } from "next/navigation";
import { getAirportTransferAccess } from "@/lib/airport-transfer/access";
import { getProjectByCode } from "@/lib/data/projects";

export default async function ProjectAirportTransferLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ projectCode: string }>;
}) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();

  const access = await getAirportTransferAccess(project.id);
  if (!access.signedIn) redirect(`/login?next=/projects/${projectCode}/airport-transfer`);
  if (!access.allowed) redirect(`/no-access?module=airport-transfer&project=${projectCode}`);

  return children;
}
```

A page under this layout that wants to show the viewer's role (the old shell's `roleLabel`) reads `getAirportTransferAccess(project.id)` itself and renders it inline — this layout no longer carries that concern, matching how Ground Transfer's own pages handle it.

- [ ] **Step 3: Update every moved page to resolve `project.id` from `params.projectCode` instead of assuming a global scope**

Each of the 6 moved pages currently calls `getAirportTransferAccess()` (unscoped) and reads/writes `airport_transfer_cases` filtered only by the case's own id, never by project. Read each file and:
1. Add `params: Promise<{ projectCode: string }>` to its props type and resolve `const { projectCode } = await params;`.
2. Add `const project = await getProjectByCode(projectCode); if (!project) notFound();` at the top.
3. Change any list query (`cases/page.tsx`, `trash/page.tsx`, `imports/page.tsx`) to add `.eq("project_id", project.id)` alongside its existing filters, so one project's Airport Transfer tab never shows another project's cases.
4. Change `cases/new/page.tsx`'s form to pass `projectId={project.id}` into `CreateCaseForm` as a fixed hidden value instead of Task 5 Step 7's free-choosing `<select>` — inside a project's own Airport Transfer tab, the project is already known from the URL, so the selector added in Task 5 is only needed for a case-creation entry point reached *without* a project in the URL (there is none after this task lands; if Task 5's Step 7 selector is now unreachable dead code, delete it here instead and note in the commit message that Task 5's selector was superseded by this task's fixed project context — whichever engineer reaches this step first should leave a one-line note in the PR description for the other).
5. Change every internal `revalidatePath`/`redirect` call inside these page files' colocated logic (there are none inside the pages themselves — they live in `actions.ts`, already project-aware via Task 5) — no change needed here.

- [ ] **Step 4: Update every `<Link>` inside Airport Transfer's own components to carry the project code**

Run: `grep -rn 'href="/airport-transfer\|href={`/airport-transfer' apps/web/components/airport-transfer`
For every match, prepend `/projects/${projectCode}` (threading `projectCode` down as a prop from whichever page renders that link — each of these components already receives enough case/project data to add one more prop).

- [ ] **Step 5: Typecheck, lint, test**

Run: `npm run typecheck -w @tomp/web && npm run lint -w @tomp/web && npm run test -w @tomp/web`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Move Airport Transfer's case pages under /projects/<code>/airport-transfer"
```

---

## Part 4 — Project shell + granting

### Task 9: The outer three-tab shell — Ground Transfer / Airport Transfer / Settings

**Files:**
- Create: `apps/web/app/(app)/projects/[projectCode]/layout.tsx`
- Create: `apps/web/components/projects/project-system-tabs.tsx`
- Create: `apps/web/app/(app)/projects/[projectCode]/page.tsx` (redirect-only, resolves the default tab)

**Interfaces:**
- Produces: `ProjectSystemTabs({ projectCode, enabledSystems, viewerSystems, active })` — renders the 3 outer tabs; a system the project has not enabled (`984`/`985`: "visible but locked... nobody clicks a tab into a dead-end") renders as plain, disabled text with the label `(ยังไม่เปิดใช้ในโครงการนี้)`; a system the project *has* enabled but this viewer cannot personally enter renders as plain text with `(ใช้อยู่ในโครงการนี้)` — matching `985` Part C step 3 exactly; only a system both enabled and personally accessible renders as a real `<Link>`.
- Consumes: `project_systems` rows for this project (query added in this task) and `getAirportTransferAccess()` account-level form / an equivalent Ground-Transfer-side account check (this profile's `project_members` rows anywhere with `system_key = 'ground_transfer'`) to decide the viewer's own access per system.

- [ ] **Step 1: Add a small data helper for a project's enabled systems + a viewer's per-system access**

```typescript
// apps/web/lib/data/project-systems.ts (new file)
import { cache } from "react";
import { resolveReadClient } from "@/lib/supabase/scoped-client";

export const getEnabledSystemKeys = cache(async function getEnabledSystemKeys(projectId: string): Promise<string[]> {
  const { client } = await resolveReadClient();
  if (!client) return ["ground_transfer"];
  const { data, error } = await client.from("project_systems").select("system_key").eq("project_id", projectId);
  if (error || !data) return ["ground_transfer"];
  return data.map((row) => String(row.system_key));
});

/** Every system_key this profile holds ANY active project_members row for, anywhere. */
export const getViewerSystemKeys = cache(async function getViewerSystemKeys(profileId: string): Promise<string[]> {
  const { client } = await resolveReadClient();
  if (!client) return [];
  const { data, error } = await client.from("project_members").select("system_key").eq("profile_id", profileId).eq("status", "active");
  if (error || !data) return [];
  return [...new Set(data.map((row) => String(row.system_key)))];
});
```

- [ ] **Step 2: Write the tabs component**

```typescript
// apps/web/components/projects/project-system-tabs.tsx
import Link from "next/link";
import { CarFront, PlaneTakeoff, Settings } from "lucide-react";

type SystemKey = "ground_transfer" | "airport_transfer";
type OuterTabKey = SystemKey | "settings";

const SYSTEM_LABEL: Record<SystemKey, string> = { ground_transfer: "Ground Transfer", airport_transfer: "Airport Transfer" };
const SYSTEM_ICON: Record<SystemKey, typeof CarFront> = { ground_transfer: CarFront, airport_transfer: PlaneTakeoff };

export function ProjectSystemTabs({
  projectCode,
  enabledSystems,
  viewerSystems,
  active
}: {
  projectCode: string;
  enabledSystems: string[];
  viewerSystems: string[];
  active: OuterTabKey;
}) {
  const systems: SystemKey[] = ["ground_transfer", "airport_transfer"];

  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-border bg-white p-1">
      {systems.map((key) => {
        const Icon = SYSTEM_ICON[key];
        const enabled = enabledSystems.includes(key);
        const accessible = viewerSystems.includes(key);
        const on = active === key;

        if (!enabled) {
          return (
            <span key={key} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-400">
              <Icon className="h-4 w-4" /> {SYSTEM_LABEL[key]} <span className="text-xs">(ยังไม่เปิดใช้ในโครงการนี้)</span>
            </span>
          );
        }
        if (!accessible) {
          return (
            <span key={key} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-400">
              <Icon className="h-4 w-4" /> {SYSTEM_LABEL[key]} <span className="text-xs">(ใช้อยู่ในโครงการนี้)</span>
            </span>
          );
        }
        return (
          <Link key={key} href={`/projects/${projectCode}/${key === "ground_transfer" ? "ground-transfer" : "airport-transfer"}`} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${on ? "bg-operation text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            <Icon className="h-4 w-4" /> {SYSTEM_LABEL[key]}
          </Link>
        );
      })}
      <Link href={`/projects/${projectCode}/settings`} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${active === "settings" ? "bg-operation text-white" : "text-slate-600 hover:bg-slate-100"}`}>
        <Settings className="h-4 w-4" /> ตั้งค่า
      </Link>
    </nav>
  );
}
```

- [ ] **Step 3: Wrap the project-code layout around both facets**

```typescript
// apps/web/app/(app)/projects/[projectCode]/layout.tsx
import { notFound } from "next/navigation";
import { getProjectByCode } from "@/lib/data/projects";
import { getEnabledSystemKeys, getViewerSystemKeys } from "@/lib/data/project-systems";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { ProjectSystemTabs } from "@/components/projects/project-system-tabs";

export default async function ProjectShellLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ projectCode: string }>;
}) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();

  const profile = await getCurrentUserProfile();
  const [enabledSystems, viewerSystems] = await Promise.all([
    getEnabledSystemKeys(project.id),
    getViewerSystemKeys(profile.id)
  ]);

  return (
    <div className="grid gap-4">
      <ProjectSystemTabs projectCode={project.projectCode} enabledSystems={enabledSystems} viewerSystems={viewerSystems} active="ground_transfer" />
      {children}
    </div>
  );
}
```

(`active` is hardcoded here because a layout cannot read its own child segment cleanly in the App Router without extra plumbing; each of the three route groups below this layout — `ground-transfer/layout.tsx`, `airport-transfer/layout.tsx`, and the new `settings/page.tsx` in Task 10 — already renders `ProjectWorkspaceTabs`/its own header, so a slightly wrong `active` highlight in this outer bar is a cosmetic nit, not a functional bug; note it in the PR description as a follow-up rather than over-engineering route-aware active-state plumbing into this plan.)

- [ ] **Step 4: The bare `/projects/[projectCode]` page picks a sensible default**

```typescript
// apps/web/app/(app)/projects/[projectCode]/page.tsx
import { redirect, notFound } from "next/navigation";
import { getProjectByCode } from "@/lib/data/projects";
import { getEnabledSystemKeys } from "@/lib/data/project-systems";

export default async function ProjectRootPage({ params }: { params: Promise<{ projectCode: string }> }) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();

  const enabled = await getEnabledSystemKeys(project.id);
  if (enabled.includes("ground_transfer")) redirect(`/projects/${projectCode}/ground-transfer`);
  if (enabled.includes("airport_transfer")) redirect(`/projects/${projectCode}/airport-transfer`);
  redirect(`/projects/${projectCode}/settings`);
}
```

- [ ] **Step 5: Typecheck, lint, test**

Run: `npm run typecheck -w @tomp/web && npm run lint -w @tomp/web && npm run test -w @tomp/web`

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/(app)/projects/[projectCode]/layout.tsx "apps/web/app/(app)/projects/[projectCode]/page.tsx" apps/web/components/projects/project-system-tabs.tsx apps/web/lib/data/project-systems.ts
git commit -m "Add the outer three-tab project shell (Ground Transfer / Airport Transfer / Settings)"
```

---

### Task 10: The shared Settings tab — member list + `project_systems` toggles

**Files:**
- Create: `apps/web/app/(app)/projects/[projectCode]/settings/page.tsx`
- Modify: `apps/web/lib/data/project-members.ts` (extend `ProjectMemberRow` with `systemKey`, and `getProjectMembers` to return rows from every system, not implicitly just Ground Transfer)
- Create: `apps/web/app/actions/project-systems.ts` (toggle action)

**Interfaces:**
- Produces: `ProjectMemberRow` gains `systemKey: string`. `getProjectMembers(projectId)`'s query already has no `system_key` filter (it never needed one before this feature existed), so after Task 1's migration it automatically starts returning both systems' rows — this task only needs to select and map the new column, not change the filter.
- Produces: `toggleProjectSystemAction(input: { projectId: string; systemKey: string; enabled: boolean }): Promise<ActionResult>` in `apps/web/app/actions/project-systems.ts`, gated by `requirePermission(projectId, "project.manage_members")` — matching `985` Part C step 2's rule that enabling/disabling a system is available to whoever can edit the project, independent of whether they personally hold access to that system.
- Consumed by: Task 11 (adds the two grant flows onto this same page).

- [ ] **Step 1: Extend `getProjectMembers`**

```typescript
// apps/web/lib/data/project-members.ts
export interface ProjectMemberRow {
  profileId: string;
  fullName: string;
  email: string;
  roleKey: string;
  systemKey: string;
  status: string;
}

function mapNested(row: Row): ProjectMemberRow {
  const profile = rowObject(row, "profiles");
  const role = rowObject(row, "roles");
  return {
    profileId: rowLoose(row, "profile_id"),
    fullName: rowLoose(profile, "full_name", "ไม่ทราบชื่อ"),
    email: rowLoose(profile, "email"),
    roleKey: rowLoose(role, "role_key"),
    systemKey: rowLoose(row, "system_key", "ground_transfer"),
    status: rowLoose(row, "status", "active")
  };
}

function mapFlat(row: Row): ProjectMemberRow {
  return {
    profileId: rowLoose(row, "profile_id"),
    fullName: rowLoose(row, "full_name", "ไม่ทราบชื่อ"),
    email: rowLoose(row, "email"),
    roleKey: rowLoose(row, "role_key"),
    systemKey: rowLoose(row, "system_key", "ground_transfer"),
    status: rowLoose(row, "status", "active")
  };
}

export const getProjectMembers = cache(async function getProjectMembers(projectId: string): Promise<ProjectMemberRow[]> {
  const { client } = await resolveReadClient();
  if (client) {
    const { data, error } = await client
      .from("project_members")
      .select("profile_id, status, system_key, profiles(full_name, email), roles(role_key)")
      .eq("project_id", projectId);
    if (!error && data) return (data as Row[]).map(mapNested);
  }

  const sql = getPostgresClient();
  if (!sql) return [];
  try {
    const rows = await sql<Row[]>`
      select pm.profile_id, pm.status, pm.system_key, p.full_name, p.email, r.role_key
      from project_members pm
      left join profiles p on p.id = pm.profile_id
      left join roles r on r.id = pm.role_id
      where pm.project_id = ${projectId}
    `;
    return rows.map(mapFlat);
  } catch {
    return [];
  }
});
```

- [ ] **Step 2: Write the toggle action**

```typescript
// apps/web/app/actions/project-systems.ts
"use server";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/rbac";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

export async function toggleProjectSystemAction(input: unknown): Promise<ActionResult> {
  const data = (input ?? {}) as { projectId?: string; systemKey?: string; enabled?: boolean };
  const projectId = String(data.projectId || "");
  const systemKey = String(data.systemKey || "");
  if (!projectId || !systemKey) return actionFailure("ข้อมูลไม่ครบถ้วน");

  const permission = await requirePermission(projectId, "project.manage_members");
  if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์แก้ไขระบบของโครงการนี้");

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  if (data.enabled) {
    const profile = await getCurrentUserProfile();
    const { error: upsertError } = await client
      .from("project_systems")
      .upsert({ project_id: projectId, system_key: systemKey, enabled_by: profile.isDevelopmentFallback ? null : profile.id }, { onConflict: "project_id,system_key" });
    if (upsertError) return actionFailure(getDatabaseErrorMessage(upsertError, "เปิดใช้ระบบไม่สำเร็จ"));
  } else {
    const { error: deleteError } = await client.from("project_systems").delete().eq("project_id", projectId).eq("system_key", systemKey);
    if (deleteError) return actionFailure(getDatabaseErrorMessage(deleteError, "ปิดใช้ระบบไม่สำเร็จ"));
  }

  return actionSuccess({ projectId, systemKey, enabled: Boolean(data.enabled) });
}
```

- [ ] **Step 3: Write the Settings page**

```typescript
// apps/web/app/(app)/projects/[projectCode]/settings/page.tsx
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/auth/access-denied";
import { ProjectDetailsForm } from "@/components/projects/project-details-form";
import { ProjectContactForm } from "@/components/projects/project-contact-form";
import { ProjectArchiveButton } from "@/components/projects/project-archive-button";
import { ProjectDeletePanel } from "@/components/projects/project-delete-panel";
import { ProjectPublishPanel } from "@/components/projects/project-publish-panel";
import { ProjectSystemToggles } from "@/components/projects/project-system-toggles";
import { ProjectMemberList } from "@/components/projects/project-member-list";
import { resolveCoordinatorPhone, resolveOperationPhone } from "@/lib/domain/contact-numbers";
import { checkProjectPublishReadiness } from "@/lib/domain/publish-readiness";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getMissionsByProjectId } from "@/lib/data/missions";
import { getOperationDaysByProjectId } from "@/lib/data/operation-days";
import { getProjectByCode } from "@/lib/data/projects";
import { getProjectMembers } from "@/lib/data/project-members";
import { getEnabledSystemKeys } from "@/lib/data/project-systems";
import { getViewerAccess } from "@/lib/auth/access";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectCode: string }> }) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();

  const { permissions, roleKeys } = await getViewerAccess();
  const canManageMembers = permissions.includes("*") || roleKeys.includes("super_admin") || permissions.includes("project.manage_members");
  const canManage = permissions.includes("*") || roleKeys.includes("super_admin") || permissions.includes("project.update");
  const canDelete = permissions.includes("*") || roleKeys.includes("super_admin") || permissions.includes("project.delete");

  if (!canManageMembers && !canManage && !canDelete) {
    return <AccessDenied title="เข้าตั้งค่าโครงการนี้ไม่ได้" reason="ต้องมีสิทธิ์จัดการโครงการนี้ก่อน ติดต่อผู้จัดการโครงการ" />;
  }

  const [members, enabledSystems, missionsResult, assignmentsResult, operationDaysResult] = await Promise.all([
    getProjectMembers(project.id),
    getEnabledSystemKeys(project.id),
    getMissionsByProjectId(project.id),
    getAssignmentsByProjectId(project.id),
    getOperationDaysByProjectId(project.id)
  ]);
  const counts = { missions: missionsResult.ok ? missionsResult.data.length : 0, assignments: assignmentsResult.ok ? assignmentsResult.data.length : 0 };

  return (
    <div className="grid gap-4">
      <section className="enterprise-panel grid gap-3 p-4">
        <h2 className="text-lg font-semibold text-ink">ข้อมูลโครงการ</h2>
        {canManage ? (
          <>
            <ProjectDetailsForm projectId={project.id} projectName={project.projectName} projectCode={project.projectCode} startDate={project.startDate} endDate={project.endDate} timezone={project.timezone} />
            <div className="border-t border-black/5 pt-3">
              <ProjectContactForm projectId={project.id} coordinatorPhone={resolveCoordinatorPhone(null, project.metadata)} operationPhone={resolveOperationPhone(null, project.metadata)} />
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-600">{project.projectName} · {project.startDate} – {project.endDate}</p>
        )}
      </section>

      <section className="enterprise-panel grid gap-3 p-4">
        <h2 className="text-lg font-semibold text-ink">ระบบที่ใช้ในโครงการนี้</h2>
        <ProjectSystemToggles projectId={project.id} enabledSystems={enabledSystems} editable={canManageMembers} />
      </section>

      <section className="enterprise-panel grid gap-3 p-4">
        <h2 className="text-lg font-semibold text-ink">สมาชิกโครงการ ({members.length})</h2>
        <ProjectMemberList projectId={project.id} members={members} editable={canManageMembers} />
      </section>

      {canManage ? (
        <ProjectPublishPanel
          projectId={project.id}
          readiness={checkProjectPublishReadiness({ project, operationDays: operationDaysResult.data, missions: missionsResult.data, assignments: assignmentsResult.data })}
        />
      ) : null}

      {canManage || canDelete ? (
        <section className="enterprise-panel grid gap-4 p-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">โซนอันตราย</h2>
            <p className="mt-1 text-sm text-slate-600">การกระทำในส่วนนี้ส่งผลกับทั้งโครงการ เก็บถาวรย้อนกลับได้ ลบถาวรย้อนกลับไม่ได้</p>
          </div>
          {canManage ? (
            <div className="grid gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <h3 className="text-sm font-bold text-amber-900">{project.status === "archived" ? "กู้คืนโครงการ" : "เก็บถาวรโครงการ"}</h3>
              <ProjectArchiveButton projectId={project.id} archived={project.status === "archived"} variant="full" />
            </div>
          ) : null}
          {canDelete ? <ProjectDeletePanel projectId={project.id} projectCode={project.projectCode} projectName={project.projectName} counts={counts} /> : null}
        </section>
      ) : null}
    </div>
  );
}
```

`ProjectSystemToggles` and `ProjectMemberList` are new components, written in Task 11 alongside the grant flow (they need the grant UI in the same place, so splitting their creation from Task 11 would leave a non-functional intermediate commit).

- [ ] **Step 4: Commit the data/action layer now; the two new components land in Task 11**

```bash
git add apps/web/lib/data/project-members.ts apps/web/app/actions/project-systems.ts "apps/web/app/(app)/projects/[projectCode]/settings/page.tsx"
git commit -m "Add the shared Settings page skeleton (members query is system-aware; system toggle action)"
```

(This commit will not build cleanly on its own — it references `ProjectSystemToggles`/`ProjectMemberList`, which do not exist until Task 11. If the executing agent commits per-task strictly, do Task 10 and Task 11 as one combined commit instead; note the deviation in the PR description.)

---

### Task 11: Granting flow — full account + lightweight project helper

**Files:**
- Create: `apps/web/components/projects/project-system-toggles.tsx`
- Create: `apps/web/components/projects/project-member-list.tsx`
- Create: `apps/web/components/projects/add-project-member-form.tsx`
- Create: `apps/web/app/actions/project-members.ts`
- Create: `database/migrations/0046_project_helper_tokens.sql`
- Copy: `supabase/migrations/0046_project_helper_tokens.sql`
- Create: `apps/web/lib/project-helper/tokens.ts`
- Create: `apps/web/app/helper/[token]/page.tsx`
- Create: `apps/web/app/actions/project-helper.ts`

**Interfaces:**
- Produces: `addProjectMemberAction(input): Promise<ActionResult>` — full-account path: given an existing profile's email or a brand-new invite, inserts a `project_members` row `{ project_id, profile_id, role_id, system_key, status: 'active' }`.
- Produces: `issueProjectHelperTokenAction(input): Promise<ActionResult>` — lightweight path: creates a `profiles` row with `auth_user_id = null` (same shape a driver's profile already has), a `project_members` row for it, and a `project_helper_tokens` row holding the QR/PIN.
- Produces: `public.project_helper_tokens(id, project_id, profile_id, token_hash, pin_hash, status, metadata jsonb, created_at)` — deliberately its own table, not reused from `driver_access_tokens`, because that table's `driver_id`/`assignment_id` columns are hard TOMP-driver concepts a project helper (e.g. an `airport_coordinator`) does not have.
- Produces: `/helper/[token]` — a public claim page mirroring `/ground-transfer/driver`'s PIN-gate pattern, landing the helper directly on their role-scoped view once claimed (Airport Transfer roles reuse the existing case/task views already gated by `getAirportTransferAccess(projectId)` from Task 5; Ground Transfer helper roles reuse the existing per-project pages from Task 7 — no new view code needed, only the claim/PIN gate).

- [ ] **Step 1: Migration for the helper token table**

```sql
-- 0046_project_helper_tokens.sql
-- docs/11-codex/984 "Granting access": a lightweight, non-expiring, revocable
-- QR/PIN for someone who needs exactly one project and no email account —
-- reusing the SHAPE of driver_access_tokens' device-binding pattern, but its
-- own table, because driver_access_tokens.driver_id/assignment_id are real
-- TOMP-driver concepts a project helper does not have.

create table public.project_helper_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint project_helper_tokens_status_check check (status in ('active', 'revoked'))
);

create index project_helper_tokens_project_idx on public.project_helper_tokens(project_id);
create index project_helper_tokens_profile_idx on public.project_helper_tokens(profile_id);

alter table public.project_helper_tokens enable row level security;
grant select, insert, update on public.project_helper_tokens to authenticated;
grant all on public.project_helper_tokens to service_role;

create policy project_helper_tokens_manage on public.project_helper_tokens
  for all
  using (
    exists (
      select 1 from public.project_members pm
      join public.profiles p on p.id = pm.profile_id
      where pm.project_id = project_helper_tokens.project_id
        and pm.status = 'active'
        and p.auth_user_id = (select auth.uid())
    )
  );
```

Run: `node scripts/apply-migrations.mjs --dry-run` then `node scripts/apply-migrations.mjs`
Run: `node scripts/sync-supabase-migrations.mjs`

- [ ] **Step 2: Token issue/verify helpers**

```typescript
// apps/web/lib/project-helper/tokens.ts
import "server-only";

import { randomBytes, createHash } from "crypto";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export interface IssuedProjectHelperToken {
  rawToken: string;
  tokenId: string;
}

export async function issueProjectHelperToken(projectId: string, profileId: string, pin: string): Promise<IssuedProjectHelperToken | null> {
  const { client } = getSupabaseWriteClient();
  if (!client) return null;

  const rawToken = randomBytes(16).toString("hex");
  const { data, error } = await client
    .from("project_helper_tokens")
    .insert({ project_id: projectId, profile_id: profileId, token_hash: hashToken(rawToken), metadata: { pinHash: hashToken(pin) } })
    .select("id")
    .single();
  if (error || !data) return null;
  return { rawToken, tokenId: String(data.id) };
}

export interface ProjectHelperClaim {
  tokenId: string;
  projectId: string;
  profileId: string;
  pinHash: string | null;
}

export async function findProjectHelperToken(rawToken: string): Promise<ProjectHelperClaim | null> {
  const { client } = getSupabaseWriteClient();
  if (!client) return null;

  const { data, error } = await client
    .from("project_helper_tokens")
    .select("id, project_id, profile_id, status, metadata")
    .eq("token_hash", hashToken(rawToken))
    .maybeSingle();
  if (error || !data || data.status !== "active") return null;

  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  return {
    tokenId: String(data.id),
    projectId: String(data.project_id),
    profileId: String(data.profile_id),
    pinHash: typeof metadata.pinHash === "string" ? metadata.pinHash : null
  };
}

export function verifyProjectHelperPin(claim: ProjectHelperClaim, pin: string): boolean {
  return claim.pinHash === hashToken(pin);
}

export async function revokeProjectHelperToken(tokenId: string): Promise<void> {
  const { client } = getSupabaseWriteClient();
  if (!client) return;
  await client.from("project_helper_tokens").update({ status: "revoked" }).eq("id", tokenId);
}
```

- [ ] **Step 3: Write the vitest for the hashing round-trip**

```typescript
// apps/web/lib/project-helper/tokens.test.ts
import { describe, expect, it, vi } from "vitest";

const rows: Record<string, unknown>[] = [];
vi.mock("@/lib/supabase/server-write", () => ({
  getSupabaseWriteClient: () => ({
    client: {
      from: () => ({
        insert: (row: Record<string, unknown>) => {
          const id = "token-1";
          rows.push({ id, ...row });
          return { select: () => ({ single: async () => ({ data: { id }, error: null }) }) };
        },
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: rows[rows.length - 1] ?? null, error: null }) }) })
      })
    }
  })
}));

import { findProjectHelperToken, issueProjectHelperToken, verifyProjectHelperPin } from "./tokens";

describe("project helper tokens", () => {
  it("verifies the PIN that was set at issue time", async () => {
    const issued = await issueProjectHelperToken("project-1", "profile-1", "1234");
    expect(issued).not.toBeNull();
    const claim = await findProjectHelperToken(issued!.rawToken);
    expect(claim).not.toBeNull();
    expect(verifyProjectHelperPin(claim!, "1234")).toBe(true);
    expect(verifyProjectHelperPin(claim!, "9999")).toBe(false);
  });
});
```

Run: `npm run test -w @tomp/web -- apps/web/lib/project-helper/tokens.test.ts`
Expected: PASS.

- [ ] **Step 4: The two grant actions**

```typescript
// apps/web/app/actions/project-members.ts
"use server";

import { z } from "zod";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { requirePermission } from "@/lib/auth/rbac";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { issueProjectHelperToken } from "@/lib/project-helper/tokens";

const addExistingSchema = z.object({
  projectId: z.string().uuid(),
  systemKey: z.enum(["ground_transfer", "airport_transfer"]),
  profileId: z.string().uuid(),
  roleKey: z.string().min(1)
});

export async function addProjectMemberAction(input: unknown): Promise<ActionResult> {
  const parsed = addExistingSchema.safeParse(input);
  if (!parsed.success) return actionFailure("ข้อมูลไม่ครบถ้วน", parsed.error.flatten().fieldErrors);

  const permission = await requirePermission(parsed.data.projectId, "project.manage_members");
  if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์เพิ่มสมาชิกโครงการนี้");

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const { data: role, error: roleError } = await client.from("roles").select("id").eq("role_key", parsed.data.roleKey).maybeSingle();
  if (roleError || !role) return actionFailure("ไม่พบบทบาทนี้ในระบบ");

  const { error: insertError } = await client.from("project_members").insert({
    project_id: parsed.data.projectId,
    profile_id: parsed.data.profileId,
    role_id: role.id,
    system_key: parsed.data.systemKey,
    status: "active"
  });
  if (insertError) {
    if (/duplicate key|unique/i.test(insertError.message)) {
      return actionFailure("บุคคลนี้มีบทบาทในระบบนี้ของโครงการนี้อยู่แล้ว");
    }
    return actionFailure(getDatabaseErrorMessage(insertError, "เพิ่มสมาชิกไม่สำเร็จ"));
  }

  return actionSuccess({ projectId: parsed.data.projectId });
}

const issueHelperSchema = z.object({
  projectId: z.string().uuid(),
  systemKey: z.enum(["ground_transfer", "airport_transfer"]),
  roleKey: z.string().min(1),
  fullName: z.string().trim().min(1, "กรุณาระบุชื่อ"),
  nickname: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  pin: z.string().regex(/^\d{4,6}$/, "รหัส PIN ต้องเป็นตัวเลข 4-6 หลัก")
});

export async function issueProjectHelperAction(input: unknown): Promise<ActionResult<{ profileId: string; helperUrl: string }>> {
  const parsed = issueHelperSchema.safeParse(input);
  if (!parsed.success) return actionFailure("ข้อมูลไม่ครบถ้วน", parsed.error.flatten().fieldErrors);

  const permission = await requirePermission(parsed.data.projectId, "project.manage_members");
  if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์เพิ่มผู้ช่วยงานในโครงการนี้");

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const { data: role, error: roleError } = await client.from("roles").select("id").eq("role_key", parsed.data.roleKey).maybeSingle();
  if (roleError || !role) return actionFailure("ไม่พบบทบาทนี้ในระบบ");

  // A project helper is a profiles row with no auth_user_id — the same shape
  // a driver's profile already has (drivers never sign in either).
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .insert({ full_name: parsed.data.fullName, nickname: parsed.data.nickname || null, phone: parsed.data.phone || null, auth_user_id: null })
    .select("id")
    .single();
  if (profileError || !profile) return actionFailure(getDatabaseErrorMessage(profileError, "สร้างข้อมูลผู้ช่วยงานไม่สำเร็จ"));

  const { error: memberError } = await client.from("project_members").insert({
    project_id: parsed.data.projectId,
    profile_id: profile.id,
    role_id: role.id,
    system_key: parsed.data.systemKey,
    status: "active"
  });
  if (memberError) return actionFailure(getDatabaseErrorMessage(memberError, "เพิ่มสมาชิกไม่สำเร็จ"));

  const issued = await issueProjectHelperToken(parsed.data.projectId, String(profile.id), parsed.data.pin);
  if (!issued) return actionFailure("ออกลิงก์เข้าใช้งานไม่สำเร็จ");

  return actionSuccess({ profileId: String(profile.id), helperUrl: `/helper/${issued.rawToken}` });
}
```

(`ActionResult<TData>` — confirmed against `apps/web/lib/actions/action-result.ts` — is `{ success, data, error, fieldErrors, warning }`; the caller reads `result.data.helperUrl`, not a bolted-on top-level field, and checks `result.success`, not `result.ok`.)

- [ ] **Step 5: The claim page**

```typescript
// apps/web/app/helper/[token]/page.tsx
import { cookies } from "next/headers";
import { findProjectHelperToken } from "@/lib/project-helper/tokens";
import { ProjectHelperPinGate } from "@/components/project-helper/project-helper-pin-gate";
import { ProjectHelperView } from "@/components/project-helper/project-helper-view";

const HELPER_PIN_COOKIE_PREFIX = "hpin_";

export default async function ProjectHelperPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const claim = await findProjectHelperToken(token);
  if (!claim) {
    return (
      <div className="grid min-h-[70vh] content-center gap-2 text-center">
        <h1 className="text-lg font-bold text-ink">ไม่พบลิงก์นี้</h1>
        <p className="mx-auto max-w-sm text-[13px] leading-6 text-ink-soft">ลิงก์อาจถูกยกเลิกแล้ว กรุณาติดต่อผู้จัดการโครงการเพื่อขอลิงก์ใหม่</p>
      </div>
    );
  }

  const store = await cookies();
  const verified = store.get(`${HELPER_PIN_COOKIE_PREFIX}${claim.tokenId}`)?.value === "1";
  if (!verified) return <ProjectHelperPinGate token={token} tokenId={claim.tokenId} />;

  return <ProjectHelperView projectId={claim.projectId} profileId={claim.profileId} />;
}
```

`ProjectHelperPinGate` mirrors `apps/web/components/driver/driver-pin-gate.tsx`'s existing form-and-cookie pattern exactly (read that file for the precise shape before writing this one — same PIN-entry UI, posting to a new server action that calls `verifyProjectHelperPin` and sets the `hpin_${tokenId}` cookie on success). `ProjectHelperView` resolves the helper's `role_key` + `system_key` from `project_members` (reusing `getAirportTransferProjectRole`-style lookup for `airport_transfer`, or the equivalent Ground Transfer role lookup for `ground_transfer`) and renders the same task/checklist component that system's own project pages already use for that role — no new checklist UI, only the routing into the existing one.

- [ ] **Step 6: `ProjectSystemToggles` and `ProjectMemberList` (owed from Task 10)**

```typescript
// apps/web/components/projects/project-system-toggles.tsx
"use client";

import { useState, useTransition } from "react";
import { toggleProjectSystemAction } from "@/app/actions/project-systems";

const SYSTEMS = [
  { key: "ground_transfer", label: "Ground Transfer" },
  { key: "airport_transfer", label: "Airport Transfer" }
];

export function ProjectSystemToggles({ projectId, enabledSystems, editable }: { projectId: string; enabledSystems: string[]; editable: boolean }) {
  const [enabled, setEnabled] = useState(new Set(enabledSystems));
  const [pending, startTransition] = useTransition();

  function toggle(systemKey: string) {
    const nextEnabled = !enabled.has(systemKey);
    startTransition(async () => {
      const result = await toggleProjectSystemAction({ projectId, systemKey, enabled: nextEnabled });
      if (result.success) {
        setEnabled((prev) => {
          const next = new Set(prev);
          if (nextEnabled) next.add(systemKey);
          else next.delete(systemKey);
          return next;
        });
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {SYSTEMS.map((system) => (
        <label key={system.key} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <input type="checkbox" checked={enabled.has(system.key)} disabled={!editable || pending} onChange={() => toggle(system.key)} />
          {system.label}
        </label>
      ))}
    </div>
  );
}
```

```typescript
// apps/web/components/projects/project-member-list.tsx
import { roleLabelTh } from "@/lib/i18n/role-th";
import type { ProjectMemberRow } from "@/lib/data/project-members";
import { AddProjectMemberForm } from "@/components/projects/add-project-member-form";

const SYSTEM_LABEL: Record<string, string> = { ground_transfer: "Ground Transfer", airport_transfer: "Airport Transfer" };

export function ProjectMemberList({ projectId, members, editable }: { projectId: string; members: ProjectMemberRow[]; editable: boolean }) {
  return (
    <div className="grid gap-3">
      {members.length ? (
        <ul className="divide-y divide-slate-100">
          {members.map((m) => (
            <li key={`${m.profileId}-${m.systemKey}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                <span className="font-medium text-ink">{m.fullName}</span>
                {m.email ? <span className="ml-2 text-xs text-slate-500">{m.email}</span> : null}
              </span>
              <span className="flex gap-1">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{SYSTEM_LABEL[m.systemKey] ?? m.systemKey}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{roleLabelTh(m.roleKey)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">ยังไม่มีสมาชิก</p>
      )}
      {editable ? <AddProjectMemberForm projectId={projectId} /> : null}
    </div>
  );
}
```

`AddProjectMemberForm` renders the two paths described in `984` ("full account" / "lightweight project helper") as two collapsible sections, each posting to `addProjectMemberAction`/`issueProjectHelperAction` respectively — write it following the existing `CreateDriverForm`/`CreateVehicleForm` form-component pattern already in this codebase (client component, `useTransition`, inline field errors from the action's `ActionResult`).

- [ ] **Step 7: Typecheck, lint, test**

Run: `npm run typecheck -w @tomp/web && npm run lint -w @tomp/web && npm run test -w @tomp/web`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add project-helper QR/PIN grant path and the full-account grant path on the Settings tab"
```

---

## Part 5 — Landing page, oversight, project creation

### Task 12: The landing page at `/`

**Files:**
- Modify: `apps/web/app/(app)/page.tsx` (full rewrite)
- Modify: `apps/web/lib/auth/role-model.ts` (`REDIRECT_BY_ROLE`)

**Interfaces:**
- Produces: `RootPage` renders one tile per `public.systems` row instead of redirecting to `/projects`. A tile is a working `<Link>` when `getViewerSystemKeys(profile.id)` (Task 9) includes that system's key, or the viewer is `super_admin`; otherwise it renders locked with `ติดต่อผู้ดูแลระบบ`.
- `resolveRedirectPath` in `role-model.ts` changes so every primary role (including `super_admin`) redirects to `/` after login instead of `/projects` — `984`: "ทุกคนเห็นระบบทุกระบบ" means login no longer auto-routes past the tile picker.

- [ ] **Step 1: Rewrite `RootPage`**

```typescript
// apps/web/app/(app)/page.tsx
import Link from "next/link";
import { CarFront, PlaneTakeoff } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getViewerAccess } from "@/lib/auth/access";
import { getViewerSystemKeys } from "@/lib/data/project-systems";

const ICONS: Record<string, typeof CarFront> = { CarFront, PlaneTakeoff };

interface SystemRow {
  key: string;
  labelTh: string;
  icon: string;
  route: string;
}

async function getActiveSystems(): Promise<SystemRow[]> {
  const { resolveReadClient } = await import("@/lib/supabase/scoped-client");
  const { client } = await resolveReadClient();
  if (!client) return [
    { key: "ground_transfer", labelTh: "Ground Transfer", icon: "CarFront", route: "ground-transfer" },
    { key: "airport_transfer", labelTh: "Airport Transfer", icon: "PlaneTakeoff", route: "airport-transfer" }
  ];
  const { data } = await client.from("systems").select("key, label_th, icon, route").eq("is_active", true).order("sort_order");
  return (data ?? []).map((row) => ({ key: String(row.key), labelTh: String(row.label_th), icon: String(row.icon), route: String(row.route) }));
}

export default async function RootPage() {
  const [systems, profile, { roleKeys }] = await Promise.all([getActiveSystems(), getCurrentUserProfile(), getViewerAccess()]);
  const isSuperAdmin = roleKeys.includes("super_admin");
  const viewerSystems = isSuperAdmin ? systems.map((s) => s.key) : await getViewerSystemKeys(profile.id);

  return (
    <div className="grid min-h-[70vh] content-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-xl font-bold text-ink">Transportation Operations Management Platform</h1>
        <p className="mt-1 text-sm text-slate-500">เลือกระบบที่ต้องการเข้าใช้งาน</p>
      </div>
      <div className="mx-auto flex flex-wrap justify-center gap-4">
        {systems.map((system) => {
          const Icon = ICONS[system.icon] ?? CarFront;
          const unlocked = viewerSystems.includes(system.key);
          if (!unlocked) {
            return (
              <div key={system.key} className="grid w-48 place-items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center opacity-60">
                <Icon className="h-8 w-8 text-slate-400" />
                <p className="font-semibold text-slate-500">{system.labelTh}</p>
                <p className="text-xs text-slate-400">🔒 ติดต่อผู้ดูแลระบบ</p>
              </div>
            );
          }
          return (
            <Link key={system.key} href={`/${system.route}`} className="grid w-48 place-items-center gap-2 rounded-2xl border border-border bg-white p-6 text-center shadow-sm transition hover:border-operation hover:shadow-md">
              <Icon className="h-8 w-8 text-operation" />
              <p className="font-semibold text-ink">{system.labelTh}</p>
              <p className="text-xs text-slate-500">เข้าใช้งาน</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

`/ground-transfer` and `/airport-transfer` as bare landing links: `/ground-transfer` needs a minimal `page.tsx` redirecting to `/projects` (the project list, filtered — see Step 3 note below); `/airport-transfer`'s existing `page.tsx` was already moved to the project-scoped path in Task 8, so create a tiny replacement at `apps/web/app/airport-transfer/page.tsx` that also redirects to `/projects`.

- [ ] **Step 2: Add the two bare system-entry redirectors**

```typescript
// apps/web/app/(app)/ground-transfer/page.tsx (new)
import { redirect } from "next/navigation";
export default function GroundTransferEntryPage() {
  redirect("/projects");
}
```

```typescript
// apps/web/app/airport-transfer/page.tsx (new — replaces the one moved out in Task 8)
import { redirect } from "next/navigation";
export default function AirportTransferEntryPage() {
  redirect("/projects");
}
```

- [ ] **Step 3: Update `/projects/page.tsx` to note it now serves both systems**

No functional change is required — `getVisibleProjects()` already lists every project the viewer has *any* membership on, across both systems, once Task 1's migration lands. Update only the copy at line 38 (`"แต่ละโครงการมีภารกิจ งาน คนขับ รถ QR และศูนย์ควบคุมแยกกัน..."`) to stop implying Ground-Transfer-only content:

```typescript
            <p className="mt-1 text-sm text-slate-600">แต่ละโครงการมีการทำงานและสิทธิ์แยกกัน · เลือกโครงการเพื่อเข้าไปทำงาน</p>
```

- [ ] **Step 4: Update `role-model.ts`**

```typescript
// apps/web/lib/auth/role-model.ts
export const PRIMARY_ROLE_ORDER = ["super_admin", "project_manager", "dispatcher", "coordinator", "customer_viewer", "driver"] as const;

export type PrimaryRole = (typeof PRIMARY_ROLE_ORDER)[number];

const REDIRECT_BY_ROLE: Record<string, string> = {
  super_admin: "/",
  project_manager: "/",
  dispatcher: "/",
  coordinator: "/",
  customer_viewer: "/portal"
};

export function resolvePrimaryRole(roleKeys: string[]): string | null {
  for (const role of PRIMARY_ROLE_ORDER) {
    if (roleKeys.includes(role)) return role;
  }
  return null;
}

export function resolveRedirectPath(primaryRole: string | null): string {
  if (!primaryRole) return "/no-access";
  return REDIRECT_BY_ROLE[primaryRole] ?? "/no-access";
}
```

- [ ] **Step 5: Typecheck, lint, test**

Run: `npm run typecheck -w @tomp/web && npm run lint -w @tomp/web && npm run test -w @tomp/web`

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/(app)/page.tsx" "apps/web/app/(app)/ground-transfer" apps/web/app/airport-transfer/page.tsx apps/web/lib/auth/role-model.ts "apps/web/app/(app)/projects/page.tsx"
git commit -m "Replace the /projects auto-redirect with the two-system landing page"
```

---

### Task 13: `/permission/*` replaces `/superadmin/{projects,audit,roles}`; dev-tools moves under `/ground-transfer`

**Files:**
- Move: `apps/web/app/(app)/superadmin/projects/page.tsx` → `apps/web/app/(app)/permission/projects/page.tsx`
- Move: `apps/web/app/(app)/superadmin/audit/page.tsx` → `apps/web/app/(app)/permission/audit/page.tsx`
- Move: `apps/web/app/(app)/superadmin/roles/page.tsx` → `apps/web/app/(app)/permission/roles/page.tsx`
- Create: `apps/web/app/(app)/permission/layout.tsx` (copy of the access gate currently in `apps/web/app/(app)/superadmin/layout.tsx`)
- Move: `apps/web/app/(app)/superadmin/dev-tools/**` (all 8 files) → `apps/web/app/(app)/ground-transfer/superadmin/dev-tools/**`
- Modify: `apps/web/lib/auth/nav-model.ts`
- Leave in place: `apps/web/app/(app)/superadmin/organizations/page.tsx`, `apps/web/app/(app)/superadmin/users/page.tsx`, `apps/web/app/(app)/superadmin/page.tsx`, `apps/web/app/(app)/superadmin/layout.tsx` — these are account/org administration, not the oversight surface `984` is renaming; `984` does not ask for them to move, and no task in this plan needs to touch them.

**Interfaces:**
- No data-shape change — this task is a pure route move plus one nav-model update. Verify each moved page's own internal links (breadcrumbs, "back" links) before committing; a few will hardcode `/superadmin/...`.

- [ ] **Step 1: Move the three oversight pages**

```bash
mkdir -p "apps/web/app/(app)/permission/projects" "apps/web/app/(app)/permission/audit" "apps/web/app/(app)/permission/roles"
git mv "apps/web/app/(app)/superadmin/projects/page.tsx" "apps/web/app/(app)/permission/projects/page.tsx"
git mv "apps/web/app/(app)/superadmin/audit/page.tsx" "apps/web/app/(app)/permission/audit/page.tsx"
git mv "apps/web/app/(app)/superadmin/roles/page.tsx" "apps/web/app/(app)/permission/roles/page.tsx"
```

- [ ] **Step 2: Read the existing superadmin layout's gate and copy it**

Run: `cat "apps/web/app/(app)/superadmin/layout.tsx"` — copy its exact `super_admin`-only redirect logic into a new file (do not guess its shape; the wording must match how the existing gate behaves so this is a pure rename, not a new authorization rule):

```typescript
// apps/web/app/(app)/permission/layout.tsx
// (Same gate as apps/web/app/(app)/superadmin/layout.tsx — copy its exact
// body here, since /permission is super_admin-only exactly like /superadmin
// was, per 984's "Platform-wide oversight" section.)
```

- [ ] **Step 3: Update every in-page link from `/superadmin/{projects,audit,roles}` to `/permission/{projects,audit,roles}`**

Run: `grep -rln '"/superadmin/projects\|/superadmin/audit\|/superadmin/roles' apps/web/app apps/web/components`
Fix every match found (breadcrumbs inside the 3 moved pages themselves, and any cross-links from `apps/web/app/(app)/superadmin/page.tsx`'s own index/hub, which is staying put but almost certainly links to the 3 pages that just moved).

- [ ] **Step 4: Move dev-tools**

```bash
mkdir -p "apps/web/app/(app)/ground-transfer/superadmin/dev-tools"
git mv "apps/web/app/(app)/superadmin/dev-tools" "apps/web/app/(app)/ground-transfer/superadmin/dev-tools"
```

Run: `grep -rln '"/superadmin/dev-tools' apps/web/app apps/web/components`
Fix every match to `/ground-transfer/superadmin/dev-tools`.

- [ ] **Step 5: Update `nav-model.ts`**

```typescript
// apps/web/lib/auth/nav-model.ts — replace the "system" section's item
  {
    titleKey: "nav.sections.system",
    items: [
      {
        href: "/permission",
        labelKey: "nav.superadmin.label",
        descriptionKey: "nav.superadmin.description",
        icon: "ShieldAlert",
        helpKey: "nav.superadmin.help",
        anyPermission: ["superadmin.access"],
        anyRole: ["super_admin"]
      }
    ]
  }
```

(The i18n keys stay the same — only the `href` moves; renaming the i18n keys themselves is out of scope and would touch every locale file for no behavioral gain.)

- [ ] **Step 6: Verify nothing else links to the moved paths**

Run: `grep -rn '"/superadmin/projects\|"/superadmin/audit\|"/superadmin/roles\|"/superadmin/dev-tools' apps/web`
Expected: no matches remain.

- [ ] **Step 7: Typecheck, lint, test**

Run: `npm run typecheck -w @tomp/web && npm run lint -w @tomp/web && npm run test -w @tomp/web`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Move /superadmin/{projects,audit,roles} to /permission; move dev-tools under /ground-transfer"
```

---

### Task 14: Project creation asks which systems it uses

**Files:**
- Modify: `database/migrations/0026_transactional_command_functions.sql`'s function is not edited in place (already applied) — instead create a new migration that replaces the function.
- Create: `database/migrations/0047_create_project_command_systems.sql`
- Copy: `supabase/migrations/0047_create_project_command_systems.sql`
- Modify: `apps/web/app/actions/projects.ts` (`createProjectAction`)
- Modify: `apps/web/components/projects/create-project-form.tsx`

**Interfaces:**
- Produces: `create_project_command(...)` gains one new parameter, `p_system_keys text[]`. For each key in that array, it inserts a `project_systems` row; for each key where the creator already holds an active `project_members` row for that `system_key` on *any other* project (i.e., they are an established user of that system, not brand new to it), it also grants them the "top" role for that system on the new project — `project_manager` for `ground_transfer`, `airport_admin` for `airport_transfer`. A system checked but the creator has never used before gets only the `project_systems` row — no membership grant — matching `985` Part C step 2's "declaring project needs vs. personal capability are different questions."
- Consumed by: `createProjectAction` (passes the checked system keys through), `create-project-form.tsx` (renders the checkboxes).

- [ ] **Step 1: Write the migration**

```sql
-- 0047_create_project_command_systems.sql
-- docs/11-codex/985 "Project creation": one new required section on project
-- creation, "ระบบที่จะใช้ในโครงการนี้" — everything else about creating a
-- project is unchanged.

create or replace function public.create_project_command(
  p_organization_id     uuid,
  p_owner_profile_id    uuid,
  p_creator_profile_id  uuid,
  p_project_code        text,
  p_project_name        text,
  p_start_date          date,
  p_end_date            date,
  p_timezone            text,
  p_visibility          text,
  p_service_level       text,
  p_metadata            jsonb,
  p_system_keys         text[]
) returns public.projects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project     public.projects;
  v_pm_role_id  uuid;
  v_system_key  text;
  v_top_role    text;
  v_role_id     uuid;
  v_has_prior   boolean;
begin
  if exists (select 1 from public.projects where project_code = p_project_code) then
    raise exception 'project_code_taken' using errcode = '23505';
  end if;

  insert into public.projects
    (organization_id, owner_profile_id, project_code, project_name, start_date, end_date,
     timezone, visibility_level, service_level, status, metadata)
  values
    (p_organization_id, coalesce(p_owner_profile_id, p_creator_profile_id), p_project_code, p_project_name,
     p_start_date, p_end_date, coalesce(nullif(p_timezone, ''), 'Asia/Bangkok'),
     coalesce(nullif(p_visibility, ''), 'internal'), coalesce(nullif(p_service_level, ''), 'standard'),
     'planning', coalesce(p_metadata, '{}'::jsonb))
  returning * into v_project;

  foreach v_system_key in array coalesce(p_system_keys, array['ground_transfer']) loop
    insert into public.project_systems (project_id, system_key, enabled_by)
    values (v_project.id, v_system_key, p_creator_profile_id)
    on conflict (project_id, system_key) do nothing;

    if p_creator_profile_id is not null then
      v_top_role := case v_system_key when 'airport_transfer' then 'airport_admin' else 'project_manager' end;

      select exists (
        select 1 from public.project_members
        where profile_id = p_creator_profile_id and system_key = v_system_key and status = 'active'
      ) into v_has_prior;

      if v_has_prior or v_system_key = 'ground_transfer' then
        select id into v_role_id from public.roles where role_key = v_top_role limit 1;
        if v_role_id is not null then
          insert into public.project_members (project_id, profile_id, role_id, system_key, status, metadata)
          values (v_project.id, p_creator_profile_id, v_role_id, v_system_key, 'active', jsonb_build_object('source', 'project_create'))
          on conflict (project_id, system_key, profile_id) do nothing;
        end if;
      end if;
    end if;
  end loop;

  return v_project;
end;
$$;

revoke all on function public.create_project_command(uuid,uuid,uuid,text,text,date,date,text,text,text,jsonb,text[]) from public, anon, authenticated;
grant execute on function public.create_project_command(uuid,uuid,uuid,text,text,date,date,text,text,text,jsonb,text[]) to service_role;

-- The old 11-argument signature is superseded, not dropped — dropping it
-- would break any in-flight request still holding the old signature during
-- a rolling deploy. Left for a later cleanup migration once confirmed unused.
```

Note the `v_has_prior or v_system_key = 'ground_transfer'` clause: every creator granting Ground Transfer to their own new project gets `project_manager` unconditionally, matching today's existing behavior exactly (the un-migrated function always granted it) — only Airport Transfer's grant is conditional on prior use, since Ground Transfer has no equivalent "never used it before" case in the current product (everyone with a login account already implicitly could use it before this feature existed).

- [ ] **Step 2: Apply and mirror**

Run: `node scripts/apply-migrations.mjs --dry-run` then `node scripts/apply-migrations.mjs`
Run: `node scripts/sync-supabase-migrations.mjs`

- [ ] **Step 3: Update `createProjectAction`**

```typescript
// apps/web/app/actions/projects.ts — inside createProjectAction, replace the client.rpc call
  const { data, error: rpcError } = await client.rpc("create_project_command", {
    p_organization_id: organizationId,
    p_owner_profile_id: parsed.data.ownerProfileId || null,
    p_creator_profile_id: creatorProfileId,
    p_project_code: parsed.data.projectCode,
    p_project_name: parsed.data.projectName,
    p_start_date: parsed.data.startDate,
    p_end_date: parsed.data.endDate,
    p_timezone: parsed.data.timezone,
    p_visibility: parsed.data.visibilityLevel,
    p_service_level: parsed.data.serviceLevel,
    p_metadata: parsed.data.metadata,
    p_system_keys: parsed.data.systemKeys?.length ? parsed.data.systemKeys : ["ground_transfer"]
  });
```

`createProjectSchema` (in `packages/types/schemas.ts` or wherever `@tomp/types/schemas` is defined — locate it with `grep -rn "createProjectSchema" packages` before editing) needs a new optional field: `systemKeys: z.array(z.enum(["ground_transfer", "airport_transfer"])).optional()`.

- [ ] **Step 4: Add the checkbox section to the form**

Read `apps/web/components/projects/create-project-form.tsx` in full before editing (its exact field-rendering and submit-handler pattern were not part of this plan's research — match its existing style rather than introducing a new one). Add a required checkbox group titled "ระบบที่จะใช้ในโครงการนี้" with two options (`Ground Transfer`, `Airport Transfer`), the system the form was reached from pre-checked (pass a `defaultSystemKey` prop from whichever page renders `<CreateProjectForm />` — `apps/web/app/(app)/projects/new/page.tsx` today has no such concept; default it to `"ground_transfer"` until Task 12's landing page can pass through which tile the user came from as a query param), submitting `systemKeys` alongside the existing fields.

- [ ] **Step 5: Typecheck, lint, test**

Run: `npm run typecheck -w @tomp/web && npm run lint -w @tomp/web && npm run test -w @tomp/web`

- [ ] **Step 6: Commit**

```bash
git add database/migrations/0047_create_project_command_systems.sql supabase/migrations/0047_create_project_command_systems.sql apps/web/app/actions/projects.ts apps/web/components/projects/create-project-form.tsx
git commit -m "Let project creation choose which systems it uses; grant the creator's own top role per system"
```

---

## Part 6 — Verification and handoff

### Task 15: Full verification pass and handoff note

**Files:**
- Create: `docs/11-codex/986-central-permission-system-shipped.md`

- [ ] **Step 1: Full local verification**

Run, in order:
```
npm run typecheck
npm run lint
npm run test
npm run build
node scripts/apply-migrations.mjs --dry-run
node scripts/verify-schema.mjs
```
Expected: every command exits 0; the dry-run shows nothing pending (all of `0043`-`0047` applied).

- [ ] **Step 2: Manual smoke pass against the deployed environment**

After `vercel --prod --yes` (deploy is not git-triggered — see Global Constraints/memory):
1. Log in as an account with only Ground Transfer access → confirm `/` shows one unlocked tile, one locked tile.
2. Open an existing project → confirm the outer 3-tab shell renders, Ground Transfer's own sub-tabs still work, Settings shows the member list with a `Ground Transfer` badge on existing members.
3. As `super_admin`, open `/permission/projects`, pick a project, open its Settings, toggle on `airport_transfer`, grant a test account `airport_dispatcher` on it.
4. Log in as that test account → confirm the Airport Transfer tile is now unlocked, `/projects/<code>/airport-transfer/cases/new` requires no project picker (already scoped), and creating a case succeeds with `project_id` set.
5. As that dispatcher, issue a project-helper QR/PIN for `airport_coordinator` on the same project; open `/helper/<token>` in an incognito window, enter the PIN, confirm it lands directly on a role-scoped checklist view, not the account login/landing flow.
6. Confirm `/driver?token=...` (old bare path) 404s and `/ground-transfer/driver?token=...` (or the mobile app's `/ground-transfer/driver/<token>` path form) works — this step will fail until the mobile app's coordinated deploy (Global Constraints note) also ships; if it is not ready yet, this step is expected to fail and is not a blocker for merging this plan's work, only for the *combined* release.

- [ ] **Step 3: Write the handoff note**

`docs/11-codex/986-central-permission-system-shipped.md` — summarize what shipped (systems registry, `project_members.system_key`, `project_systems`, project-code-first URLs, the three-tab shell, the two grant paths, `/permission`), what's still open (the mobile `buildDriverWebUrl()` coordination — link the exact line, `apps/mobile-driver/src/config.ts:32`; Part B of `985`, the Ground Transfer handoff, still fully deferred; role_permissions wiring for the 5 `airport_*` roles, noted in Task 2 as deliberately not done), and supersede `984`/`985`'s "Next step" sections by pointing at this file instead.

- [ ] **Step 4: Commit**

```bash
git add docs/11-codex/986-central-permission-system-shipped.md
git commit -m "Record the central permission system as shipped; note what remains open"
```

---

## Self-review notes (from the author of this plan, not a placeholder)

- **Corrections made to the source design docs while writing this plan**, each because the actual code contradicted the doc's assumption: (1) `project_members` has no bare `role_key` text column — `role_id` is a real FK to `public.roles(id)`, so Airport Transfer's 5 role keys are inserted as real `roles` rows in Task 2, not validated as free text; (2) `984`'s "old bare paths... simply gone" list is too broad — `/resources` is genuinely dual-purpose (global library vs. project view) in one file, and `/recovery` is cross-project by design, not project-scoped at all; both get resolved on their actual merits in Task 7, not by the doc's literal list.
- **Task 10/11 split leaves one intentionally non-buildable intermediate commit** (flagged inline in Task 10 Step 4) — acceptable because both tasks are reviewed together in practice; call it out explicitly if executing via `subagent-driven-development`'s per-task review gate.
- **Not covered by this plan, on purpose:** `985` Part B (the Ground Transfer handoff), wiring the 5 new `airport_*` roles into `role_permissions`/`ROLE_PERMISSIONS` (Airport Transfer's own `access.ts` never reads that matrix), and any `apps/mobile-driver/**` change.
