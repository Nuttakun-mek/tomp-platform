# RBAC Phase 3 — Data scoping (RLS) Implementation Plan

> **For agentic workers:** ใช้ superpowers:executing-plans — task-by-task, verify ทุก task, ไม่ push จนกว่าจะ review.

**Goal:** เปลี่ยนการอ่านข้อมูลจาก service-role (bypass RLS ทุกอย่าง) → session-aware client ที่ถูก RLS กรองตาม scope ของผู้ใช้ โดยไม่ทำให้ super_admin / org admin / dev fallback มองไม่เห็นข้อมูล

**Architecture:** RLS ที่ DB เป็นตัวบังคับ scope (มาก่อน), แล้ว data layer ค่อยเปลี่ยน client หลัง flag `TOMP_SCOPED_READS=1`. เขียนยังเป็น service-role + `requirePermission` (เข้มขึ้น). `is_super_admin()` / `is_org_admin()` SECURITY DEFINER เป็น bypass ที่ทุก policy อ้าง

**Tech Stack:** Postgres RLS · `@supabase/ssr` createServerClient · Next.js server components · vitest · `scripts/apply-migrations.mjs`

## Global Constraints

- Migration `0019` **ต้อง apply ก่อน** เปลี่ยน data client เสมอ (local → cloud)
- ทุก `create policy` นำหน้าด้วย `drop policy if exists` (idempotent — DB มี object นอก migration record)
- ทุก migration mirror ไป `supabase/migrations/` ผ่าน `node scripts/sync-supabase-migrations.mjs`
- ทุก task จบด้วย typecheck + lint + test เขียว
- ห้าม `npm run build` ขณะ dev server รัน — หยุด dev + `rm -rf apps/web/.next` ก่อน build
- Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com> ทุก commit
- `TOMP_SCOPED_READS` ยังไม่เปิดใน production จนกว่า RLS test suite เขียว + review

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `database/migrations/0019_rbac_rls_v2.sql` | helper fn + super_admin/org bypass บน policy เดิม + แทน `sprint2_*` ที่เหลือ |
| `database/tests/rls_rbac_v2.sql` | manual/CI verification — seeded users เห็นเฉพาะ scope |
| `scripts/seed-test-users.mjs` | สร้าง 4 auth user + profile + role (super_admin, org_admin, pm@P1, dispatcher@P2) |
| `apps/web/lib/supabase/scoped-client.ts` | ใหม่ — `getScopedDataClient()` (session-aware) + `resolveReadClient()` (flag-gated) |
| `apps/web/lib/data/*.ts` (9 ไฟล์อ่าน) | read → `resolveReadClient()` |
| `apps/web/lib/auth/rbac.ts` | `requirePermission` — global-permission set, org-scope path |
| `apps/web/app/actions/projects.ts` | + `project_members` + `owner_profile_id` ตอนสร้าง, ลบ escape hatch |
| `apps/web/lib/auth/rbac.test.ts` | ใหม่ — global permission routing |
| `apps/web/components/app-shell.tsx` + `components/workspace/project-scope-pill.tsx` | scope pill + cookie (Task 20) |

---

## Task 15 — migration `0019_rbac_rls_v2.sql`: helper fns + bypass

**Files:** Create `database/migrations/0019_rbac_rls_v2.sql`

**Produces:** SQL functions `public.current_profile_id()`, `public.is_super_admin()`, `public.is_org_admin(uuid)`, `public.is_project_member(uuid)`; rewritten SELECT policies on projects/project_days/sessions/missions/call_signs/assignments/assignment_versions/timeline_events/driver_* + replacements for organizations/profiles/drivers/vehicles/gps_locations/driver_issue_reports/driver_access_tokens/driver_checkins/vehicle_checkins/assignment_status_updates.

- [ ] **Step 1: helper functions** (SECURITY DEFINER, `set search_path = public`)

```sql
create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where auth_user_id = (select auth.uid()) limit 1
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    join public.profiles p on p.id = ura.profile_id
    where p.auth_user_id = (select auth.uid())
      and ura.status = 'active'
      and ura.project_id is null
      and r.role_key = 'super_admin'
  )
$$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    join public.profiles p on p.id = ura.profile_id
    where p.auth_user_id = (select auth.uid())
      and ura.status = 'active'
      and ura.project_id is null
      and ura.organization_id = target_org
      and r.role_key in ('organization_admin','super_admin')
  )
$$;

create or replace function public.is_project_member(target_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_members pm
    join public.profiles p on p.id = pm.profile_id
    where pm.project_id = target_project
      and pm.status = 'active'
      and p.auth_user_id = (select auth.uid())
  )
$$;

grant execute on all functions in schema public to authenticated, service_role;
```

- [ ] **Step 2: project-scoped SELECT policies → add super_admin + org-admin bypass**

สำหรับตารางที่มี `project_id` ตรง (project_days, sessions, missions, call_signs, assignments, timeline_events) + `projects` เอง + `assignment_versions` (ผ่าน assignment): drop policy เดิม (`project_members_select_*`) แล้วสร้างใหม่เป็น:

```sql
drop policy if exists "project_members_select_projects" on public.projects;
create policy "rbac_select_projects" on public.projects for select to authenticated
using (
  public.is_super_admin()
  or public.is_org_admin(organization_id)
  or public.is_project_member(id)
);
-- project_days/sessions/missions/call_signs/assignments/timeline_events:
--   using ( public.is_super_admin() or public.is_project_member(<table>.project_id)
--           or exists (select 1 from public.projects pr where pr.id = <table>.project_id and public.is_org_admin(pr.organization_id)) )
```

drop policy เดิมชื่อเก่าทั้ง `project_members_select_*` และ `sprint2_authenticated_read_*` (0002) ที่ตรงกัน.

- [ ] **Step 3: driver-ops SELECT policies (0011) → add bypass**

drop `"project members read <x>"` ทั้ง 6 (driver_assignment_packets, driver_notifications, route_change_instructions, driver_location_sessions, driver_contact_events, driver_acknowledgements) แล้วสร้างใหม่ `using ( public.is_super_admin() or public.is_project_member(<t>.project_id) )`. คง service_role policy เดิมไว้.

- [ ] **Step 4: mirror + apply local**

```bash
node scripts/sync-supabase-migrations.mjs
node scripts/apply-migrations.mjs --yes    # .env.local ปัจจุบันชี้ cloud — ดู Step 5
```

- [ ] **Step 5: verify** — `node scripts/apply-migrations.mjs --dry-run --yes` → `0019` applied. `psql` (หรือ pg_meta) รัน `select public.is_super_admin();` ในฐานะ anon → false, ไม่ error.

- [ ] **Step 6: commit** `feat(rls): 0019 helper fns + super_admin/org bypass on project-scoped policies`

---

## Task 16 — migration `0019` (ต่อ): แทน `sprint2_*` broad policies ที่เหลือ

**Files:** Modify `database/migrations/0019_rbac_rls_v2.sql` (ต่อจาก Task 15 — ไฟล์เดียว, ยังไม่ push จึงแก้ได้)

**Consumes:** helper fns จาก Task 15.

- [ ] **Step 1: organizations**

```sql
drop policy if exists "sprint2_authenticated_read_organizations" on public.organizations;
create policy "rbac_select_organizations" on public.organizations for select to authenticated
using (
  public.is_super_admin()
  or id = (select organization_id from public.profiles where auth_user_id = (select auth.uid()) limit 1)
);
```

- [ ] **Step 2: profiles** — self + same-org + super_admin

```sql
drop policy if exists "sprint2_authenticated_read_profiles" on public.profiles;
create policy "rbac_select_profiles" on public.profiles for select to authenticated
using (
  public.is_super_admin()
  or auth_user_id = (select auth.uid())
  or organization_id = (select organization_id from public.profiles where auth_user_id = (select auth.uid()) limit 1)
);
```

- [ ] **Step 3: drivers + vehicles** — org ของ resource หรือ อยู่ใน assignment ของ project ที่เป็น member

```sql
drop policy if exists "sprint2_authenticated_read_drivers" on public.drivers;
create policy "rbac_select_drivers" on public.drivers for select to authenticated
using (
  public.is_super_admin()
  or public.is_org_admin(organization_id)
  or organization_id = (select organization_id from public.profiles where auth_user_id = (select auth.uid()) limit 1)
  or exists (
    select 1 from public.assignments a
    where a.driver_id = drivers.id and public.is_project_member(a.project_id)
  )
);
-- vehicles: เหมือนกัน เปลี่ยน a.driver_id → a.vehicle_id
```

- [ ] **Step 4: gps_locations + driver_issue_reports** — project member เท่านั้น (sensitive, ไม่มี org-wide)

```sql
drop policy if exists "sprint2_authenticated_read_gps_locations" on public.gps_locations;
create policy "rbac_select_gps_locations" on public.gps_locations for select to authenticated
using ( public.is_super_admin() or public.is_project_member(project_id) );

drop policy if exists "sprint2_authenticated_read_driver_issue_reports" on public.driver_issue_reports;
drop policy if exists "sprint2_authenticated_insert_driver_issue_reports" on public.driver_issue_reports;
create policy "rbac_select_driver_issue_reports" on public.driver_issue_reports for select to authenticated
using ( public.is_super_admin() or public.is_project_member(project_id) );
-- insert ยังทำผ่าน service-role (server action) — ไม่สร้าง authenticated insert policy ใหม่
```

- [ ] **Step 5: driver_access_tokens / driver_checkins / vehicle_checkins / assignment_status_updates** — project member + super_admin (service_role policy เดิมคงไว้สำหรับ QR)

```sql
-- ทั้ง 4: drop "sprint2_authenticated_read_<t>"; create "rbac_select_<t>" for select to authenticated
--   using ( public.is_super_admin() or public.is_project_member(<t>.project_id) );
```

- [ ] **Step 6: timeline_events sprint2 insert cleanup** — `drop policy if exists "sprint2_authenticated_insert_timeline_events" on public.timeline_events;` (0005 มี `project_members_insert_timeline_events` แล้ว)

- [ ] **Step 7: project_members self-read**

```sql
-- 0004/0007 grant select ให้ authenticated แต่ยังไม่มี policy → RLS อาจ deny หมด ตรวจก่อน
drop policy if exists "rbac_select_project_members" on public.project_members;
create policy "rbac_select_project_members" on public.project_members for select to authenticated
using (
  public.is_super_admin()
  or profile_id = public.current_profile_id()
  or public.is_project_member(project_id)
);
```

- [ ] **Step 8: sync + apply + dry-run verify + commit** `feat(rls): 0019 replace remaining sprint2 broad read policies with scoped`

---

## Task 17 — RLS test suite + seed script

**Files:** Create `scripts/seed-test-users.mjs`, `database/tests/rls_rbac_v2.sql`

- [ ] **Step 1: `scripts/seed-test-users.mjs`** — ใช้ service-role client (จาก .env.local): สร้าง (idempotent, upsert by email)
  - `super@tomp.test` → profile + `user_role_assignments` (super_admin, project_id null, organization_id = org หลัก)
  - `orgadmin@tomp.test` → organization_admin (org หลัก)
  - `pm1@tomp.test` → project_members (project_manager) บน project A
  - `disp2@tomp.test` → project_members (dispatcher) บน project B
  - ถ้าไม่มี project A/B → สร้าง 2 project เปล่าใต้ org หลัก
  - print auth_user_id + project ids ออกมาให้ test sql
  - `--reset` ลบ 4 user

- [ ] **Step 2: `database/tests/rls_rbac_v2.sql`** — psql script รับ `:super_id :org_id :pm1_id :disp2_id :project_a :project_b` แล้ว:

```sql
-- helper: จำลอง session ของ user
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'pm1_id')::text, true);
-- pm1 เห็น project A ไม่เห็น B
select count(*) = 1 as pm1_sees_only_a from public.projects;
select not exists(select 1 from public.projects where id = :'project_b') as pm1_no_b;
-- super เห็นทั้งหมด
select set_config('request.jwt.claims', json_build_object('sub', :'super_id')::text, true);
select count(*) >= 2 as super_sees_all from public.projects;
-- disp2 เห็น B ไม่เห็น A; ไม่เห็น gps ของ A
```

รวม assertion เป็น `select ... as label` ทุกอันควร true.

- [ ] **Step 3: รัน** `node scripts/seed-test-users.mjs` แล้ว `psql "$SUPABASE_DB_URL" -f database/tests/rls_rbac_v2.sql -v ...` → ทุก assertion true

- [ ] **Step 4: commit** `test(rls): seed-test-users + rbac_v2 scope verification`

---

## Task 18 — `getScopedDataClient()` + flag-gated read client

**Files:** Create `apps/web/lib/supabase/scoped-client.ts`; Modify `apps/web/lib/data/{projects,missions,assignments,call-signs,resources,timeline,locations,driver-operations}.ts`

**Produces:** `getScopedDataClient(): Promise<SupabaseClient | null>` · `resolveReadClient(): Promise<{ client, scoped: boolean }>`

- [ ] **Step 1: test** `apps/web/lib/supabase/scoped-client.test.ts` — `resolveReadClient` คืน `scoped: false` เมื่อ `TOMP_SCOPED_READS` ไม่ใช่ `"1"`; คืน `scoped: true` เมื่อ `=1` และมี session client. (mock `getSessionAwareAuthClient` + env)

- [ ] **Step 2: implement `scoped-client.ts`**

```ts
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { readCleanEnv } from "@/lib/env";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";
import { createTimeoutFetch } from "./fetch-timeout";

export async function getScopedDataClient() {
  const url = readCleanEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const anon = readCleanEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anon) return null;
  const store = await cookies();
  return createServerClient(url, anon, {
    global: { fetch: createTimeoutFetch(8000) },
    cookies: { getAll: () => store.getAll(), setAll: () => {} }
  });
}

export async function resolveReadClient(): Promise<{ client: ReturnType<typeof getSupabaseServerDataClient>; scoped: boolean }> {
  if (readCleanEnv("TOMP_SCOPED_READS") === "1") {
    const scoped = await getScopedDataClient();
    if (scoped) {
      const { data } = await scoped.auth.getUser();
      if (data.user) return { client: scoped as never, scoped: true };
    }
  }
  return { client: getSupabaseServerDataClient(), scoped: false };
}
```

- [ ] **Step 3: wire read functions** — ในแต่ละไฟล์ `lib/data/*` เปลี่ยน `const supabase = getSupabaseServerDataClient()` → `const { client: supabase } = await resolveReadClient()` (function เป็น async อยู่แล้ว). Postgres/demo fallback path **คงไว้** (ยิงเมื่อ client null หรือ error) — ไม่แตะใน task นี้.

- [ ] **Step 4: verify** typecheck + lint + test. `grep -rn getSupabaseServerDataClient apps/web/lib/data` เหลือเฉพาะใน fallback helper + `enrichLocationMetadata`.

- [ ] **Step 5: commit** `feat(data): resolveReadClient — session-scoped reads behind TOMP_SCOPED_READS`

---

## Task 19 — `requirePermission` org-scope + ลบ escape hatch

**Files:** Modify `apps/web/lib/auth/rbac.ts`, `apps/web/app/actions/projects.ts`; Create `apps/web/lib/auth/rbac.test.ts`

- [ ] **Step 1: test** `rbac.test.ts` — mock `getCurrentUserProfile` + `getUserRoles`:
  - `requirePermission("<orgId>", "project.create")` เมื่อ user มี global role `organization_admin` → `allowed: true` (ไม่ route ไป project-membership)
  - เมื่อ user ไม่มี role → `allowed: false`
  - dev fallback → `allowed: true`

- [ ] **Step 2: implement** — เพิ่ม

```ts
const GLOBAL_PERMISSIONS = new Set(["project.create", "admin.manage_users", "org.manage", "superadmin.access"]);
```

ใน `requirePermission`: ถ้า `GLOBAL_PERMISSIONS.has(permissionKey)` → ใช้ branch เดียวกับ `!projectId` (dev fallback → allow; else `getUserRoles(profile.id)` + `roleHasPermission`) โดยไม่สนใจ slot `projectId`/`organizationId`.

- [ ] **Step 3: `projects.ts`** — เปลี่ยน `if (!permission.allowed && mode !== "service_role")` → `if (!permission.allowed)`; ตรวจ `requirePermission(parsed.data.organizationId, "project.create")` ยังเรียกเหมือนเดิม (ตอนนี้ route ถูกแล้ว).

- [ ] **Step 4: verify** typecheck + lint + test (คาดมี test อื่นที่พึ่ง escape hatch — แก้ให้ mock permission allowed).

- [ ] **Step 5: commit** `fix(rbac): project.create routes to global-role check; drop service_role escape hatch`

---

## Task 20 — create-project → project_members + owner

**Files:** Modify `apps/web/app/actions/projects.ts`; Test `apps/web/app/actions/projects.test.ts` (ถ้ามี) หรือ `lib/data`

- [ ] **Step 1: test** — createProjectAction (mock write client) หลัง insert project → เรียก insert `project_members` ด้วย `role_id` ของ `project_manager` + `profile_id` ของผู้สร้าง, และ `owner_profile_id` ถูก set

- [ ] **Step 2: implement** — หลัง `mapProject(data)`:
  - resolve `profile.id` จาก `getCurrentUserProfile()`
  - ถ้าไม่ dev fallback: lookup `roles.id` where `role_key='project_manager'`; `client.from("project_members").insert({ project_id: project.id, profile_id, role_id, status: 'active', metadata: { source: 'project_create' } })`
  - ถ้า `owner_profile_id` ยังว่าง → `client.from("projects").update({ owner_profile_id: profile.id }).eq("id", project.id)`
  - error ตอนนี้ = warning ใน `actionSuccess` (ไม่ rollback project)

- [ ] **Step 3: verify** typecheck + lint + test

- [ ] **Step 4: commit** `feat(projects): creator becomes project_manager member + owner on create`

---

## Task 21 — `<ProjectScopePill>` + scope cookie (UX)

**Files:** Create `apps/web/components/workspace/project-scope-pill.tsx`, `apps/web/lib/workspace/scope.ts`; Modify `apps/web/components/app-shell.tsx`

- [ ] **Step 1: test** `lib/workspace/scope.test.ts` — `readScopeCookie` / `resolveActiveScope(projects, cookieValue)` คืน project แรกถ้า cookie ว่าง/ไม่ตรง, คืนตัวที่ตรงถ้ามี

- [ ] **Step 2: `lib/workspace/scope.ts`** — `SCOPE_COOKIE = "tomp_scope"`, `resolveActiveScope(projects: {id,projectCode,projectName}[], cookieVal?: string)`

- [ ] **Step 3: `<ProjectScopePill>`** (client) — แสดงชื่อ+รหัสโครงการปัจจุบัน + lifecycle badge; dropdown เลือกโครงการอื่น (จากรายการที่ viewer เห็น); เลือกแล้ว `document.cookie = ...` + `router.refresh()`

- [ ] **Step 4: `app-shell.tsx`** — โหลด `getProjects()` (ตอนนี้ scoped แล้ว), หา active scope จาก cookie, render `<ProjectScopePill>` บนสุด sidebar เหนือ nav

- [ ] **Step 5: verify** typecheck + lint + test + build (หยุด dev ก่อน) + screenshot `/` และ `/projects` — pill แสดง, ไม่มี overflow

- [ ] **Step 6: commit** `feat(ux): ProjectScopePill + scope cookie in app shell`

---

## Task 22 — เปิด flag local + regression + handoff

- [ ] **Step 1:** `.env.local` เพิ่ม `TOMP_SCOPED_READS=1`
- [ ] **Step 2:** dev server + login เป็น super_admin จริง → ทุกหน้าเปิดได้, `/projects` เห็นครบ
- [ ] **Step 3:** (ถ้า seed users ใช้ได้) login เป็น `pm1@tomp.test` → เห็นเฉพาะ project A
- [ ] **Step 4:** typecheck + lint + test + build เขียว
- [ ] **Step 5:** handoff `928-rbac-phase-3-done.md` + อัปเดต `922` status → "Phase 0-3 ✅"; ระบุ: prod ยังไม่เปิด `TOMP_SCOPED_READS` จนกว่าจะ review + run RLS suite บน staging
- [ ] **Step 6:** commit `docs: Phase 3 done — RLS data scoping`

---

## Self-review notes

- **super_admin bootstrap ยังไม่มี auth_user_id ตอน seed?** — `bootstrapFirstProfileIfEmpty` set auth_user_id ทันที; seeded user จาก script ต้องสร้างผ่าน `auth.admin.createUser` เพื่อได้ auth_user_id จริง
- **`current_profile_id()` เป็น STABLE SECURITY DEFINER** — ปลอดภัยเพราะ query แค่ profiles ของตัวเอง; ไม่รับ input
- **org-admin เห็น drivers/vehicles ทั้ง org** — ตรงตาม §2.7; ถ้า sensitive เกินไปค่อยแคบใน Phase 5
- **Type consistency:** `resolveReadClient()` คืน `{ client, scoped }` — ใช้ชื่อนี้ทุก call site ใน Task 18; `getScopedDataClient()` (ไม่ใช่ `getScopedClient`)
- **fallback path เดิม (Postgres/demo) ยัง bypass scope** — acceptable ชั่วคราว (dev + `TOMP_ENABLE_POSTGRES_FALLBACK=1` เท่านั้น); Phase 3 ไม่แตะ, บันทึกใน handoff เป็น known gap
