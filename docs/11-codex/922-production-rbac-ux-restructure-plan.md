# Production RBAC + UX/UI Restructure — Plan

**วันที่:** 2026-09-08
**สถานะ:** Phase 0-2 ✅ · Phase 3 ถัดไป (data scoping — RLS) — impl plan [923](923-rbac-phase-0-1-impl-plan.md), handoff [924](924-rbac-phase-0-1-done.md)
**ผู้เกี่ยวข้องก่อนหน้า:** `958d226` (stabilize) · `72e822b`–`cd70dea` (design-system pass) · `0b4f8bf`+`a98f4f7`+`464ef10` (auth foundation) · handoffs [920](920-pilot-stability-followup-handoff.md), [921](921-production-reset-auth-handoff.md)

เป้าหมาย: เปลี่ยนจาก "internal pilot ทุกคนเห็นเท่ากัน" → **ระบบ production ที่แต่ละบัญชีเข้าถึงต่างกันตามบทบาท** โดยยึด docs ที่มีอยู่ ([001](../00-foundation/001-vision-and-philosophy.md), [102](../01-business/102-customer-and-stakeholder-model.md), [103](../01-business/103-project-lifecycle.md), [400](../04-product/400-product-workspaces.md), [500](../05-ux/500-ux-blueprint.md), [504](../05-ux/504-product-experience-reset.md), [805](../08-engineering/805-auth-and-rbac-foundation.md))

---

## 1. Current-state audit

### 1.1 Auth (ทำแล้ว)

| ส่วน | สถานะ |
|---|---|
| `middleware.ts` | บังคับ login ทุก path ยกเว้น `/login`, `/auth/callback`, `/driver`, `/api/driver`, `/api/health`, `/_next` |
| `AuthGate` (client, ใน `app-shell`) | เช็ค session ซ้ำอีกชั้น — **ซ้ำซ้อนกับ middleware** และเพิ่ม loading flash |
| `getSessionAwareAuthClient()` | มี cookie-aware SSR client แล้ว แต่ **ไม่มีใครใช้อ่านข้อมูล** |
| `getCurrentUserProfile()` | resolve auth user → profile; first-login bootstrap → `super_admin`. **`roleLabel` hardcode "ผู้ใช้งานระบบ"** ไม่ resolve role จริง |
| หน้า `/login` | email magic link + Google OAuth (ต้องเปิด provider ใน Supabase) |

### 1.2 RBAC (บางส่วน)

| ส่วน | สถานะ |
|---|---|
| DB: `roles`(11), `permissions`(17), `project_members`, `user_role_assignments` | seed แล้ว |
| `role_permissions` (join table) | **ว่าง** — app ใช้ hardcoded map `ROLE_PERMISSIONS` ใน [`lib/auth/permissions.ts`](../../apps/web/lib/auth/permissions.ts) |
| RLS SELECT policies | **ผสม**: `0005` ทำ project-scoped ให้ projects/project_days/sessions/missions/call_signs/assignments/assignment_versions/timeline_events/publish_locks แล้ว — **แต่ยังเป็น broad `sprint2_authenticated_read_*` (authenticated คนไหนก็อ่านได้)** สำหรับ `organizations`, `profiles`, `drivers`, `vehicles`, `gps_locations`, `driver_access_tokens`, checkins, issue reports |
| RLS: `super_admin` bypass | **ไม่มี** — super_admin ที่ไม่ใช่ project member จะมองไม่เห็นอะไรผ่าน RLS |
| RLS: global roles (`user_role_assignments`) | **ไม่ถูกพิจารณา** — RLS ดูแค่ `project_members` |
| write actions | เช็ค `requirePermission` ครบทุก action (projects/missions/assignments/publish/resources/incidents/change) |
| **แต่** [`projects.ts:23`](../../apps/web/app/actions/projects.ts#L23) | `if (!permission.allowed && mode !== "service_role")` → **write client เป็น `service_role` เสมอ → RBAC บน write ถูก bypass ทั้งหมด** |
| `requirePermission(organizationId, "project.create")` | ส่ง orgId เข้า slot ของ projectId → route ไปเช็ค project-membership → ถ้าไม่ bypass จะ **deny ทุกคน** (bug) |
| หน้าเว็บ (`page.tsx`) | **ไม่มีหน้าไหนเช็คสิทธิ์** — login แล้วเปิด URL ตรง ๆ เข้าได้หมด |
| data layer (`lib/data/*`, 11 ไฟล์) | ใช้ `getSupabaseServerDataClient()` = **service-role → bypass RLS** → `getProjects()` คืนทุกโปรเจกต์ |
| สร้าง project แล้ว | **ไม่สร้าง `project_members` ให้ผู้สร้าง** → creator มองไม่เห็นโปรเจกต์ตัวเองผ่าน RLS |

### 1.3 Information Architecture

- Nav เดียว flat 2 section: "ใช้งานจริง" (6 เมนู) + "ตรวจระบบ" (live-test / admin / login)
- **test tools โผล่ให้ทุก role เห็น**: `/live-test`, `/admin`, `/admin/pilot-smoke-test`, `/admin/data-quality`, `/admin/enterprise-readiness`, `/admin/operations`, `/pilot-checklist`
- docs [400](../04-product/400-product-workspaces.md) นิยาม 7 workspace แต่ UI ไม่ได้แยกตาม role เลย
- route ซ้ำ/ค้าง: `/project` (เอกพจน์, 43 บรรทัด) กับ `/projects`; `/recovery` มีแต่ nav ไม่ลิงก์

---

## 2. Target architecture

### 2.1 Entry / auth flow

```
เปิดเว็บ https://<app>
  ├─ ไม่มี session → /login  (แบรนด์ + email/Google, ไม่ใช่ marketing page)
  ├─ /auth/callback → exchange code → resolve/link profile + roles (ดู §2.4b)
  │     ├─ มี profile (auth_user_id ตรง) → redirect ตาม primary role (§2.4)
  │     ├─ มี profile ที่ email ตรง + auth_user_id ว่าง (invited) → auto-link → redirect
  │     ├─ ไม่มี profile และ DB profiles ว่าง → bootstrap super_admin (มีแล้ว)
  │     └─ ไม่มี profile และ DB มี profile อื่น → /no-access
  └─ /driver, /driver/[token], /api/driver/*  → public (QR flow, ไม่แตะ)
```

**`/no-access`** (ใหม่): หน้าอธิบายว่าบัญชีนี้ยังไม่ได้รับสิทธิ์ + ปุ่มติดต่อผู้ดูแล + ปุ่มออกจากระบบ

### 2.2 App shell (shell เดียว ทุก role)

```
┌─────────────┬──────────────────────────────────────────┐
│ WORKSPACE    │  Topbar: breadcrumb · project switcher   │
│  SWITCHER    │          · notifications · user menu     │
│ (org/scope)  ├──────────────────────────────────────────┤
│              │                                          │
│  NAV         │            <page content>                │
│ (permission- │                                          │
│  filtered)   │                                          │
│              │                                          │
│  ── footer:  │                                          │
│  user · role │                                          │
│  · env badge │                                          │
└─────────────┴──────────────────────────────────────────┘
```

- **Project scope switcher** (บนสุด sidebar): เลือก project scope ปัจจุบัน; จำ context ล่าสุดใน cookie. **Org switcher = backlog** (phase นี้มี org เดียวจาก bootstrap — decision #1)
- **Nav = permission-filtered**: เมนูที่ไม่มี permission → **ไม่ render** (ไม่ใช่ render แล้ว 403)
- ลบ `AuthGate` (middleware พอแล้ว) — เหลือ server-side guard อย่างเดียว ลด flash

### 2.3 Nav model (core, ทุก workspace ใช้ shell เดียว)

**คง route path เดิมไว้** (decision #2) — ไม่ rename `/mission-control`, `/assignments`. เหตุผล: `missionControlUrl: /mission-control?projectId=...` ถูก generate + ส่งกลับ client + อาจเก็บใน metadata แล้ว; rename = ต้อง migrate data + permanent redirect; ประโยชน์ด้านความชัดเจนของ URL operator ภายในน้อย. จัดกลุ่ม nav ใหม่ + redirect หลัง login พอ.

| กลุ่ม | เมนู | permission ที่ต้องมี | route (เดิม) |
|---|---|---|---|
| **ปฏิบัติการ** | ภาพรวม | (login) | `/` |
| | ศูนย์ควบคุม | `assignment.read` (project ใดก็ได้) | `/mission-control` |
| | บอร์ด Assignment | `assignment.read` | `/assignments` |
| **วางแผน** | โครงการ | `project.read` | `/projects` |
| | ทรัพยากร (คนขับ/รถ) | `driver.read` \|\| `vehicle.read` | `/resources` |
| **ประสานงาน** | งานที่ได้รับมอบหมาย | role `coordinator` | `/coordinator` |
| | คำขอเปลี่ยนแปลง | `change.create` \|\| role `organizer` | `/changes` |
| **องค์กร** | ผู้ใช้ & สิทธิ์ | `admin.manage_users` | `/org/members` |
| **ระบบ** (เฉพาะ super_admin) | Superadmin | role `super_admin` | `/superadmin` |

> เอาแค่ `/portal` เพิ่มเป็น route ใหม่จริง (organizer/customer read-only — decision #3 ทำใน scope นี้); `/coordinator`, `/vendor`, `/changes`, `/org/members` = route ใหม่ที่ทำเป็น v1 ตาม phase

### 2.4 Role → primary workspace (post-login redirect)

| role (global/org หรือ project เด่นสุด) | redirect ไป | เหตุผล |
|---|---|---|
| `super_admin` | `/` (portfolio) พร้อมแบนเนอร์ลิงก์ `/superadmin` | เห็นทุกอย่าง |
| `organization_admin` | `/` | ภาพรวม org |
| `operation_manager` | `/mission-control` | command center |
| `project_manager` / `planner` | `/projects` | เริ่มจากวางแผน |
| `dispatcher` | `/assignments` | บอร์ดจัดสรร |
| `coordinator` | `/coordinator` | scope งานตัวเอง |
| `organizer` / `customer_viewer` | `/portal` | read-only + change request |
| `vendor` | `/vendor` | คนขับ/รถของตัวเอง |
| ไม่มี role | `/no-access` | |

หน้า `/` (ภาพรวม) ปรับ card/section ตาม permission — ไม่ redirect ซ้ำ ให้เป็น home ที่ทุก role เปิดได้แต่เห็นต่างกัน

### 2.4b Invite / เพิ่มผู้ใช้ใหม่ (decision #5)

**เลือก: pre-provision + auto-link ตอน login** (ต่อยอดจาก `bootstrapFirstProfileIfEmpty` ที่มีอยู่)

```
1. admin ที่ /superadmin/users → "เพิ่มผู้ใช้"
     กรอก: email · ชื่อ · organization · role (global/org) และ/หรือ project + role ต่อ project
2. ระบบสร้าง profiles (auth_user_id = NULL, status = 'invited')
     + user_role_assignments / project_members ตามที่เลือก
3. คนนั้นเปิด /login → login ด้วย email เดียวกัน (magic link หรือ Google)
4. /auth/callback:
     - เจอ profiles ที่ email ตรง และ auth_user_id เป็น NULL
       → UPDATE auth_user_id, status = 'active'  (auto-link)
       → ได้ role ที่ admin ตั้งไว้ทันที
     - เจอ profiles ที่ auth_user_id ตรงแล้ว → login ปกติ
     - ไม่เจอ profiles และ DB profiles ว่าง → bootstrap super_admin (เดิม)
     - ไม่เจอ profiles และ DB มี profile อื่น → /no-access
```

ไม่ต้องใช้ Supabase admin invite API / email template แยก — ใช้ Supabase Auth ปกติ + จับคู่ด้วย email. admin ควบคุมสิทธิ์ล่วงหน้าได้เต็มที่.
ความเสี่ยง: email ที่ admin กรอกต้องตรงกับ email ที่ login เป๊ะ — UI ควรเตือน + admin แก้ profile ที่ยัง `invited` ได้

### 2.5 RBAC model — source of truth

**ตัดสินใจ:** ใช้ **`role_permissions` ใน DB เป็น source of truth** (seed จาก `ROLE_PERMISSIONS` map เดิม) + cache ใน memory ต่อ request

- migration ใหม่ `0018_seed_role_permissions.sql`: insert `role_permissions` จาก matrix ใน [`permissions.ts`](../../apps/web/lib/auth/permissions.ts) — คงพฤติกรรมเดิม แต่ย้ายเข้า DB
- `lib/auth/permissions.ts` เปลี่ยนเป็น loader ที่อ่านจาก DB (มี fallback เป็น hardcoded map ถ้า DB อ่านไม่ได้)
- เพิ่ม permission ที่ขาด: `change.create/approve/apply`, `driver.create`, `vehicle.create`, `incident.*`, `recovery.*`, `org.manage`, `superadmin.access`

### 2.6 Scope model (3 ระดับ)

```
user_role_assignments:
  project_id = NULL, organization_id = NULL  → GLOBAL role  (super_admin)
  project_id = NULL, organization_id = <org> → ORG role     (organization_admin)
  project_id = <proj>                        → PROJECT role  (ทางเลือก, ปกติใช้ project_members)
project_members:
  project_id + profile_id + role_id          → PROJECT role  (planner/dispatcher/coordinator/... ต่อโปรเจกต์)
```

`getUserRoles(profileId, projectId?)` (มีอยู่แล้ว) รวม global + org + project → ใช้ตัวนี้เป็นหลัก แก้ให้รวม org-scoped ด้วย

### 2.7 Data scoping — RLS + session client (ตามที่เลือก)

**หลักการ:** อ่าน = RLS ที่ DB ผ่าน authenticated session client; เขียน = service-role + `requirePermission` (เข้มขึ้น)

การเปลี่ยนแปลง:

1. **`lib/supabase/server.ts`** — เพิ่ม `getScopedDataClient()` ที่คืน session-aware client (จาก cookie) สำหรับอ่าน; คง `getSupabaseServerDataClient()` (service role) ไว้เฉพาะ (a) fallback เมื่อไม่มี session (dev), (b) งาน system เช่น bootstrap, superadmin
2. **`lib/data/*` (11 ไฟล์)** — เปลี่ยน `getSupabaseServerDataClient()` → `getScopedDataClient()` สำหรับ read functions; ผล = RLS กรอง project ที่ไม่ใช่ member ออกอัตโนมัติ; ลบ Postgres/demo fallback ที่ bypass scope ออกจาก path production (คงไว้เฉพาะ `TOMP_ENABLE_POSTGRES_FALLBACK=1` + dev)
3. **RLS migration ใหม่ `0019_rbac_rls_v2.sql`:**
   - `super_admin` bypass: ทุก policy เพิ่ม `OR public.is_super_admin()` (SECURITY DEFINER function เช็ค `user_role_assignments` global)
   - org-scoped read: `organization_admin` เห็นทุก project ใน org ตัวเอง
   - **drop `sprint2_authenticated_read_*` ที่เหลือ** แล้วแทนด้วย scoped policy: `drivers`/`vehicles` (org ของ resource หรือ project ที่ resource ถูก assign), `gps_locations` (project member เท่านั้น — sensitive), `organizations` (org ตัวเอง), `profiles` (ตัวเอง + org role), `driver_access_tokens` (project member + service_role สำหรับ QR validation)
   - `project_members` self-read + `admin.manage_users` write
4. **สร้าง project** — action สร้าง `project_members` (role `project_manager`) ให้ผู้สร้างในทรานแซกชันเดียว + set `owner_profile_id`
5. **แก้ `requirePermission`** — `project.create` เป็น org/global permission: signature รับ `{ organizationId }` แยกจาก `{ projectId }`; ลบ escape hatch `mode !== "service_role"` ออก (ให้เช็คจริงเสมอใน production; dev fallback ยังผ่านได้ผ่าน `isDevelopmentFallback`)
6. **RLS test suite** — `database/tests/rls_*.sql` + สคริปต์ seed users จำลอง 3-4 role รันผ่าน CI/manual

### 2.8 Superadmin area (`/superadmin/*`)

route แยก, layout แยก (ธีมเข้ม + แถบ "INTERNAL — platform staff only"), gate: `requireRole("super_admin")` ใน `layout.tsx` (redirect `/` ถ้าไม่ใช่)

```
/superadmin
  ├─ /users              ผู้ใช้ทั้งหมด · ค้นหา · assign role (global/org/project) · deactivate
  ├─ /roles              role × permission matrix (แก้ role_permissions)
  ├─ /organizations      CRUD org · โอนย้าย project
  ├─ /projects           project ทุก org · เพิ่ม/ลบ member · เปลี่ยนสถานะ lifecycle
  ├─ /audit              timeline ข้ามโครงการ · filter ตาม actor/type/project
  └─ /dev-tools          (ย้ายมาจาก /live-test + /admin/*)
       ├─ live-test         (QR → GPS → Mission Control ทีละ flow)
       ├─ smoke-test        (pilot smoke scenario)
       ├─ data-quality      (ชื่อไทยเพี้ยน, ข้อมูลไม่ครบ)
       ├─ readiness         (12 แกนระบบ)
       ├─ infra-health      (Supabase / migration / RLS status)
       └─ seed / reset      (guarded: พิมพ์ยืนยัน + env check)
```

- ลบ `/live-test`, `/admin`, `/admin/*`, `/pilot-checklist`, `/project` ออกจาก nav หลัก และ **redirect เก่า → `/superadmin/dev-tools/*`**
- ให้ dev-tools ทำงานทั้ง dev และ prod (super_admin เท่านั้น) — เพราะ "ใช้พัฒนาแต่ละฟังก์ชัน" ตามที่ระบุ; guard ด้วย role ไม่ใช่ env

### 2.9 UX/UI ต่อ role (ตาม [400](../04-product/400-product-workspaces.md) + [504](../05-ux/504-product-experience-reset.md))

> **รายละเอียด UX ครบ + pattern กันสับสน/กันพลาด อยู่ใน §7** — ส่วนนี้เป็นแค่ role → หน้าหลัก

| workspace | หน้าแรก (route เดิม) | หน้าจอหลัก | สิ่งที่ **ไม่** เห็น |
|---|---|---|---|
| Operation Manager | `/mission-control` | Command center · Readiness · Timeline · Incident · Recovery | superadmin, planning edit |
| Planner / PM | `/projects/[id]` | Project setup · Mission editor · Assignment planner · Publish review | dispatch live actions, superadmin |
| Dispatcher | `/assignments` | Dispatch lanes · Call Sign · QR · driver/vehicle assign · status | project create/publish, org settings |
| Coordinator | `/coordinator` (ใหม่) | งานที่ได้รับ (scoped) · ยืนยัน arrival/boarding/completion · แจ้งปัญหา | โครงการอื่น, resource pool, planning |
| Organizer / Customer | `/portal` (ใหม่) | ภาพรวมโครงการ (permitted) · สถานะ mission · change request · เอกสาร | ข้อมูลคนขับ, GPS ดิบ, dispatch |
| Vendor | `/vendor` (ใหม่, backlog) | คนขับ/รถ ของตัวเอง · availability · replacement request | โครงการ, GPS, assignment ของ vendor อื่น |
| Driver | `/driver` (QR, มีแล้ว) | assignment card · route sheet · GPS share · issue report | ทุกอย่างนอกงานตัวเอง |

### 2.10 Design-system (ต่อยอดจาก `72e822b`)

- คง type scale / tokens / `.page-grid` เดิม
- component ใหม่ทั้งหมดอยู่ใน **§7.7**
- Superadmin layout: reuse shell แต่ palette เข้ม + แถบ "INTERNAL — platform staff" + `data-area="superadmin"`

---

## 3. Rollout phases

> ทุก phase: typecheck + lint + test เขียว + ผ่าน **UX acceptance checklist (§8)** ที่เกี่ยวข้อง, ไม่ push จนกว่าจะ review

**สถานะ:** Phase 0 + Phase 1 ✅ เสร็จ (2026-09-08) — ดู [923 impl plan](923-rbac-phase-0-1-impl-plan.md) + [924 handoff](924-rbac-phase-0-1-done.md). Phase 2 เป็นลำดับถัดไป.

### Phase 0 — เตรียม (ไม่กระทบผู้ใช้) ✅
1. `getUserPrimaryRole()` + `getAccessibleWorkspaces()` + `getUserPermissions()` ใน `lib/auth/`
2. migration `0018_seed_role_permissions.sql` (ย้าย matrix เข้า DB)
3. `lib/auth/permissions.ts` → DB loader + fallback map
4. RLS test harness + `scripts/seed-test-users.mjs` (4 role จำลอง)

### Phase 1 — Auth flow + nav gating + UX baseline ✅
5. `/auth/callback` → resolve/auto-link profile (§2.4b) → redirect ตาม role (§2.4)
6. `/no-access` + `<AccessDenied>` component
7. `app-nav.tsx` → permission-filtered + จัดกลุ่มใหม่ (§2.3)
8. ลบ `AuthGate` (เหลือ middleware) — ลด flash
9. `getCurrentUserProfile().roleLabel` → resolve จริง + `<RoleBadge>` ใน sidebar footer
10. UX: `<PermissionGate>`, `<EmptyState>` baseline, breadcrumb ในหน้า scoped

### Phase 2 — Superadmin section + ย้าย test tools ✅
11. `/superadmin/layout.tsx` + role gate + ธีมเข้ม + แถบ "INTERNAL"
12. ย้าย `/live-test`, `/admin/*`, `/pilot-checklist` → `/superadmin/dev-tools/*` + `redirects()` เก่า
13. `/superadmin/dev-tools` landing (จัดกลุ่มเครื่องมือ)
14. `/superadmin/users` — list + **ฟอร์ม "เพิ่มผู้ใช้"** (pre-provision profile + assign role/project) — ปลดล็อกไม่ต้องยิง SQL

### Phase 3 — Data scoping (RLS) — กระทบสูงสุด
15. migration `0019_rbac_rls_v2.sql` **มาก่อน**: `is_super_admin()` bypass · org-scope · drop `sprint2_*` ที่เหลือ · scoped policy สำหรับ drivers/vehicles/gps_locations/organizations/profiles
16. RLS test suite ผ่านครบ (seeded users เห็นเฉพาะ scope)
17. `getScopedDataClient()` (session-aware) + เปลี่ยน `lib/data/*` read → scoped client (หลัง flag `TOMP_SCOPED_READS=1`)
18. create-project → สร้าง `project_members` (project_manager) + `owner_profile_id` ในทรานแซกชันเดียว
19. แก้ `requirePermission` (`project.create` = org-scope) + ลบ escape hatch `mode !== "service_role"`
20. UX: `<ProjectScopePill>` + scope switcher + scope cookie; `ข้อมูลตัวอย่าง` badge เข้มงวด
21. เปิด flag ทีละ env → prod

### Phase 4 — Workspace UX + error-reduction patterns (§7.3–7.6)
22. `/portal` (organizer/customer read-only v1 — decision #3): ภาพรวม + สถานะ mission + change request + ไม่เห็น GPS/คนขับ
23. home `/` — section ตาม permission + redirect ที่ถูกต้องต่อ role
24. `<OwnerTag>` ทุก object ปฏิบัติการ (assignment/incident/change/mission)
25. `<ContactStrip>` ในทุกหน้า operational (dispatch, mission-control, coordinator, driver)
26. `<ConflictWarning>` inline ตอน assign driver/vehicle (ASN-005/006, VEH-006)
27. `<ReadinessGate>` + `<ConfirmImpactDialog>` ก่อน publish (PUB-004/005) — ปุ่ม publish ล็อกจนเขียว
28. `<ChangeRequestButton>` แทนปุ่มแก้หลัง publish (PUB-003, CHG-*)
29. `<NotificationCard>` — ข้อความ + ปุ่ม action + scoped (NOT-001/003)
30. dispatch fluency: bulk assign, keyboard nav, inline edit + `<SavePanel>`, saved filter
31. `<UndoToast>` + optimistic update + rollback ทุก action; toast → ลิงก์ Timeline

### Phase 5 — Superadmin depth + workspace เต็ม (backlog)
32. `/superadmin/roles` matrix editor · `/organizations` · `/superadmin/projects` (cross-org + member mgmt) · `/superadmin/audit`
33. `/coordinator` (mobile-optimized: ปุ่มยืนยันใหญ่ thumb-reach) + `/vendor` + `/changes` เต็มรูปแบบ
34. command palette (`Cmd/Ctrl+K`) · saved views

---

## 4. ความเสี่ยง / จุดต้องระวัง

| ความเสี่ยง | บรรเทา |
|---|---|
| เปลี่ยน data layer เป็น RLS แล้ว **super_admin มองไม่เห็นอะไร** | migration `0019` (`is_super_admin()` bypass) มาก่อนเปลี่ยน data client เสมอ (Phase 3 ลำดับ 14 → 15) |
| session client อ่านช้ากว่า service-role (RLS join) | index `project_members(project_id, profile_id, status)` มีแล้ว; วัด p95; cache membership ต่อ request |
| middleware เรียก `supabase.auth.getUser()` ทุก request | acceptable (Supabase แนะนำ) — แต่ให้ `matcher` แคบลง ไม่ครอบ `/api/*` ที่ไม่ต้อง |
| Postgres/demo fallback bypass scope | production ปิด `TOMP_ENABLE_POSTGRES_FALLBACK`; fallback path throw แทน return demo (ทำแล้วบางส่วนใน `aae50cd`) |
| ย้าย test tools แล้ว dev คนอื่นหาไม่เจอ | redirect เก่า + note ใน README + handoff |
| RLS ผิด → ผู้ใช้จริงเข้าไม่ได้ตอน deploy | RLS test suite blocking + rollout Phase 3 หลัง Phase 1-2 เสถียร + feature flag `TOMP_SCOPED_READS=1` เปิดทีละ env |
| `role_permissions` ว่างตอน migrate | `0018` seed ก่อน; loader มี fallback map |
| การ rename route กระทบ bookmark/QR | QR ใช้ `/driver` ไม่กระทบ; internal links เป็น `<Link>` แก้พร้อมกัน; ใส่ `redirects()` ใน next.config |

---

## 5. Decisions (confirmed 2026-09-08)

1. **Multi-org** — ❌ ไม่ทำ phase นี้ (org เดียวจาก bootstrap); switcher = project scope เท่านั้น, org switcher = backlog
2. **rename route** — ❌ ไม่ rename; คง `/mission-control`, `/assignments`; จัดกลุ่ม nav + redirect หลัง login พอ (ดู §2.3)
3. **`/portal` (organizer/customer read-only)** — ✅ ทำใน scope นี้ (Phase 4)
4. **dev-tools บน production** — ✅ ใช้เต็ม; gate ด้วย role `super_admin` ไม่ใช่ env; ทำงานได้ทั้ง dev และ prod
5. **invite flow** — ✅ pre-provision + auto-link ด้วย email (ดู §2.4b); ไม่ใช้ Supabase invite API

---

## 6. ไฟล์/พื้นที่ที่จะถูกแตะ (ประเมิน)

```
apps/web/middleware.ts                      แก้ matcher + redirect map
apps/web/app/auth/callback/route.ts         + role resolution + redirect
apps/web/app/no-access/page.tsx             ใหม่
apps/web/app/superadmin/**                  ใหม่ (~8-12 หน้า)
apps/web/app/{live-test,admin,pilot-checklist,project}/  ลบ/redirect
apps/web/components/app-nav.tsx             permission-filtered + regroup
apps/web/components/app-shell.tsx           + ProjectScopePill/switcher, ลบ AuthGate
apps/web/components/auth/**                 + PermissionGate, RoleBadge, AccessDenied
apps/web/components/ui/**                   + EmptyState, Breadcrumb, OwnerTag, ContactStrip,
                                             ConflictWarning, ReadinessGate, ChangeRequestButton,
                                             ConfirmImpactDialog, NotificationCard, UndoToast,
                                             SavePanel, ConnectionStatus  (§7.7 — ทยอยตาม phase)
apps/web/lib/auth/{permissions,rbac,current-user}.ts   DB loader + role resolution + scope
apps/web/lib/supabase/server.ts            + getScopedDataClient
apps/web/lib/data/*.ts (11)                 read → scoped client
apps/web/app/actions/projects.ts           + project_members on create, แก้ permission
database/migrations/0018_seed_role_permissions.sql   ใหม่
database/migrations/0019_rbac_rls_v2.sql             ใหม่
database/tests/rls_*.sql                             ใหม่
scripts/seed-test-users.mjs                          ใหม่
next.config.ts                              + redirects()
```

---

## 7. UX & interaction design — ลดความสับสน + ลดความผิดพลาดการประสานงาน

> อ้างอิง [501](../05-ux/501-ui-design-system.md) (visual tone), [505](../05-ux/505-thai-copy-guideline.md) (copy), [105](../01-business/105-business-rules.md) (rules ที่ต้องบังคับใน UI), [104](../01-business/104-operational-workflow.md) (workflow)

### 7.1 North star

ทุกหน้าจอต้องทำให้ผู้ใช้ตอบได้ทันทีใน 3 วินาที:

1. **ฉันอยู่ที่ไหน** — โครงการ/scope ปัจจุบัน แสดงตลอด (บน sidebar + breadcrumb)
2. **ฉันทำอะไรได้ที่นี่** — ปุ่ม action ที่มีสิทธิ์เท่านั้น; ที่ไม่มีสิทธิ์ = ไม่แสดง (ไม่ใช่ disable เงียบ ๆ)
3. **อะไรที่รอฉันตัดสินใจ** — exception/readiness ขึ้นก่อนข้อมูลทั่วไปเสมอ
4. **ใครรับผิดชอบอะไร** — ทุก object (assignment, incident, change, mission) แสดง **เจ้าของ + บทบาท + เวลาล่าสุด** ไม่มี "ลอย"

### 7.2 Anti-confusion (นำทาง + บริบท)

| ปัญหาเดิม | แก้ด้วย |
|---|---|
| nav เดียว flat, test tools ปนงานจริง | nav จัดกลุ่มตามงาน (ปฏิบัติการ/วางแผน/ประสานงาน/องค์กร) + กรอง permission + superadmin แยกธีม |
| ไม่รู้กำลังดูโครงการไหน | **project scope pill** บนสุด sidebar (ชื่อ+รหัสโครงการ+lifecycle badge) กดเปลี่ยนได้; ทุกหน้าที่ scoped ขึ้น breadcrumb `โครงการ / <ชื่อ> / <หน้า>` |
| เปิด URL ตรงเข้าได้หมด | ไม่มีสิทธิ์ → `<AccessDenied>` (อธิบายว่าต้อง role อะไร + ปุ่มกลับ) ไม่ใช่หน้าเปล่า/500 |
| object เรียกชื่อไม่ตรงกันข้ามหน้า | ยึด [505 core terms](../05-ux/505-thai-copy-guideline.md): โครงการ · ภารกิจ · งานที่จัดสรร · Call Sign · คนขับ · รถ — ใช้คำเดียวทุกที่ |
| หน้าเปล่าเมื่อไม่มีข้อมูล | `<EmptyState>` = onboarding: บอกขั้นถัดไป + ปุ่มทำเลย ("ยังไม่มีภารกิจ → เพิ่มภารกิจแรก") |
| raw enum / ISO date | Thai label ทุกที่ (ทำแล้วบางส่วน `72e822b`) + `ยังไม่ระบุ` สำหรับข้อมูลว่าง + `ข้อมูลตัวอย่าง` badge สำหรับ fallback |
| ปุ่มเยอะ ไม่รู้อันไหนหลัก | 1 primary action/หน้า (teal), ที่เหลือ secondary; destructive = แดง + ต้องยืนยัน |

### 7.3 Anti-error (การประสานงาน) — บังคับผ่าน UI

| business rule | UI pattern |
|---|---|
| ASN-005/006, VEH-006 — ห้ามจอง driver/vehicle ซ้อนเวลา | ตอนเลือก driver/รถ ใน assignment planner → **ตรวจ conflict inline**: ถ้าซ้อน แสดงแถบแดง "คนขับนี้มีงาน <Call Sign> เวลา <...>" + block; ต้องกด "ขอ override" + ใส่เหตุผล → ลง timeline |
| PUB-004/005 — publish ต้องผ่าน conflict + readiness | ปุ่ม "ประกาศใช้แผน" **disabled จนกว่า readiness = เขียว**; กดแล้วเปิด panel สรุป: X ภารกิจ · Y งาน · Z blocker — ยืนยันอีกครั้งพร้อมเห็น impact |
| MIS-007, PUB-003, CHG-* — publish แล้วห้ามแก้ตรง | หลัง publish: ปุ่ม "แก้ไข" ทั้งหมด → เปลี่ยนเป็น **"ขอเปลี่ยนแปลง"** (สีเหลือง); เปิด form change request บังคับ: เหตุผล + ผลกระทบ (ภารกิจ/งาน/คนขับ/รถ/Call Sign/commitment) ก่อนส่ง |
| CHG-005 — critical change ต้อง approve | change ที่กระทบ published assignment → สถานะ "รออนุมัติ" + ระบุผู้อนุมัติ; ผู้มีสิทธิ์เห็นใน exception feed |
| CHG-008, NOT-001/003 — แจ้งผู้เกี่ยวข้อง + notification ต้องมี action | ทุก notification card = ข้อความ + **ปุ่ม action** + ผู้รับที่ scoped; ไม่มี notification ลอยไม่มีปุ่ม |
| MIS-009, GPS-006 — completion ต้องมี confirmation source | สถานะ mission/assignment แสดง **"ยืนยันโดย: <ชื่อ> (<บทบาท>) · <เวลา>"**; GPS แค่ "คาดว่าถึงแล้ว" ไม่เปลี่ยนสถานะเอง |
| COO-008, DRV-009 — contact matrix ต้องเห็น | ทุกหน้า operational (dispatch, coordinator, driver card) มี **contact strip**: ผู้ประสานงาน + operation + คนขับ พร้อมปุ่มโทร/ข้อความ ไม่ต้องหา |
| ASN-008, TIM-001 — status change = timeline | ทุก action ที่เปลี่ยนสถานะ → toast "บันทึกแล้ว" + ลิงก์ "ดูใน Timeline"; ไม่มีการเปลี่ยนสถานะเงียบ |
| GPS-003/004 — GPS หายไม่ทำให้ mission fail | GPS หาย → หมุดเป็นสีเทา + ป้าย "ขาดสัญญาณ — ใช้การยืนยันด้วยคน"; ไม่ใช่สีแดง alarm |
| INC-004 — critical incident → recovery mode | เปิด incident ระดับ critical → banner ทั้ง workspace + ลิงก์ recovery panel; recovery ไม่ลบแผนเดิม (แสดงคู่กัน "แผนเดิม / แผนกู้คืน") |

### 7.4 Fluency (ทำงานคล่อง)

- **Dispatch board**: เลือกงานหลายอันแล้ว bulk assign driver/vehicle; drag ระหว่าง lane เพื่อเปลี่ยนสถานะ; keyboard (`j/k` เลื่อน, `a` assign, `/` ค้นหา)
- **Inline edit** แทน modal — แก้ค่าในการ์ดได้เลย, บันทึกอัตโนมัติ + indicator "บันทึกแล้ว"
- **Side panel** แทน modal สำหรับรายละเอียด (assignment, incident, change) — ยังเห็น context ด้านหลัง
- **Scope memory** — จำโครงการ + filter ล่าสุดต่อผู้ใช้ (cookie); เปิดเว็บมาอยู่ที่เดิม
- **<3 คลิก** ถึง action หลักของแต่ละ role จากหน้าแรก
- **Command palette** (`Cmd/Ctrl+K`) — ไปโครงการ/ภารกิจ/คนขับ/หน้า ได้เร็ว (phase หลัง)
- **Saved views** — dispatcher เซฟ filter "งานวันนี้ที่ยังไม่มีคนขับ" ไว้

### 7.5 Feedback & state

- โหลด = **skeleton** ตรงตำแหน่งจริง ไม่ใช่ spinner กลางจอ
- สำเร็จ = toast สั้น + undo (ถ้าทำได้) ภายใน 5 วิ
- error = inline ตรง field/การ์ด + ข้อความบอกวิธีแก้ ไม่ใช่ error code
- **optimistic update** + rollback ถ้า fail — ไม่ทำ action หายเงียบ
- connection/realtime status ที่มุมเดียว: "เชื่อมต่อสด / สำรองด้วยการดึงข้อมูล / ออฟไลน์" (มีแล้วใน mission control — ขยายให้ทุกหน้า operational)

### 7.6 Per-workspace — หน้าหลัก + คำถามที่ตอบ + กันพลาด

| workspace | หน้าหลัก | คำถามที่ตอบ | primary action | กันพลาดเฉพาะทาง |
|---|---|---|---|---|
| Operation Manager `/mission-control` | Command Center | "ตอนนี้อะไรเสี่ยง อะไรต้องตัดสินใจ" | เปิด incident / อนุมัติ change | exception feed จัดลำดับตามความรุนแรง + เวลา; decision prompt มีปุ่ม |
| Planner `/projects/[id]` | Planning workspace | "แผนพร้อม publish หรือยัง ติดอะไร" | ประกาศใช้แผน | readiness checklist บังคับ; conflict check ก่อน publish; ปุ่ม publish ล็อกจนเขียว |
| Dispatcher `/assignments` | Dispatch lanes | "งานไหนยังไม่พร้อม ใครยังไม่มีคนขับ" | สร้าง QR / assign | conflict inline ตอน assign; QR สร้างได้เมื่อ Call Sign+คนขับ+รถ ครบ (แสดง "ขาด: รถ") |
| Coordinator `/coordinator` (mobile) | งานที่ได้รับ (scoped) | "งานถัดไปของฉันคืออะไร ต้องยืนยันอะไร" | ยืนยัน arrival/boarding/completion | เห็นเฉพาะ scope ตัวเอง; ปุ่มยืนยันใหญ่ thumb-reach; แจ้งปัญหา = 2 แตะ |
| Organizer `/portal` (read-only) | ภาพรวมโครงการ | "งานไปถึงไหนแล้ว มั่นใจได้ไหม" | ส่งคำขอเปลี่ยนแปลง | ไม่มีปุ่มแก้ตรง; change request เข้า workflow + เห็นสถานะคำขอตัวเอง; ไม่เห็น GPS ดิบ/ข้อมูลคนขับ |
| Vendor `/vendor` | คนขับ/รถ ของตัวเอง | "รถ/คนขับฉันถูกใช้ที่ไหน ต้องเปลี่ยนตัวไหม" | ขอเปลี่ยนตัว (replacement) | เห็นเฉพาะ resource + assignment ของ vendor ตัวเอง |
| Driver `/driver` (mobile, มีแล้ว) | Assignment card | "งานฉันคืออะไร ไปไง ติดต่อใคร" | แชร์ GPS / เปิด Google Maps / แจ้งปัญหา | 1 การ์ด 1 งาน; ปุ่มหลักล่างจอ; แจ้งปัญหา quick-action |

### 7.7 Component ที่ต้องเพิ่ม

`<ProjectScopePill>` · `<Breadcrumb>` · `<PermissionGate>` (client+server) · `<AccessDenied>` · `<EmptyState>` · `<RoleBadge>` · `<OwnerTag>` (ชื่อ+บทบาท+เวลา) · `<ContactStrip>` · `<ConflictWarning>` · `<ReadinessGate>` · `<ChangeRequestButton>` (แทนปุ่มแก้หลัง publish) · `<ConfirmImpactDialog>` (สรุปผลกระทบก่อน publish/cancel/replace) · `<NotificationCard>` (ข้อความ+action) · `<ConnectionStatus>` · `<SavePanel>` (side panel) · `<UndoToast>`

### 7.8 UX เข้า phase ไหน (ไม่รอ Phase 4)

- **Phase 1**: `<AccessDenied>`, `<PermissionGate>`, `<RoleBadge>`, nav grouping, breadcrumb, `<EmptyState>` baseline
- **Phase 2**: superadmin ธีมแยก + แถบ "INTERNAL"; `/superadmin/users` ฟอร์มเพิ่มผู้ใช้ที่ชัดเจน
- **Phase 3**: `<ProjectScopePill>` + scope switcher (จำเป็นเมื่อ data ถูก scope แล้ว), `ข้อมูลตัวอย่าง` badge เข้มงวด
- **Phase 4**: `<OwnerTag>`, `<ContactStrip>`, `<ConflictWarning>`, `<ReadinessGate>`, `<ChangeRequestButton>`, `<ConfirmImpactDialog>`, `<NotificationCard>`, dispatch fluency (bulk/keyboard), inline edit + `<SavePanel>`, `/portal`
- **Phase 5**: command palette, saved views, `/coordinator` + `/vendor` mobile-optimized

---

## 8. UX acceptance checklist (ใช้ตอน review แต่ละ phase)

- [ ] เปิดหน้าไหนก็รู้ว่าอยู่โครงการไหน + role อะไร ภายใน 3 วิ
- [ ] เมนู/ปุ่มที่ไม่มีสิทธิ์ = ไม่แสดง (ไม่มี dead-end 403)
- [ ] ทุก object ปฏิบัติการมีเจ้าของ + เวลาล่าสุดที่มองเห็น
- [ ] exception/readiness อยู่เหนือข้อมูลทั่วไปทุกหน้า operational
- [ ] หน้าเปล่า = onboarding พร้อมปุ่มขั้นถัดไป (ไม่มีตารางว่างลอย)
- [ ] ไม่มี raw enum / ISO datetime / คำ dev หลุดถึงผู้ใช้
- [ ] publish ล็อกจน readiness เขียว + แสดง impact ก่อนยืนยัน
- [ ] หลัง publish ไม่มีปุ่มแก้ตรง — เป็น "ขอเปลี่ยนแปลง" ที่เข้า workflow
- [ ] conflict (คนขับ/รถ ซ้อนเวลา) เตือน inline + บังคับเหตุผลถ้า override
- [ ] contact strip เห็นได้ทุกหน้า operational
- [ ] ทุก notification มีปุ่ม action
- [ ] action สำเร็จ = toast + ลิงก์ Timeline; fail = rollback + ข้อความแก้ไข
- [ ] mobile: coordinator/driver ปุ่มหลักอยู่ในระยะนิ้วโป้ง แตะได้ ≤2 ครั้งถึง action หลัก
- [ ] ≤3 คลิกจากหน้าแรกถึง action หลักของ role นั้น
- [ ] 0 horizontal overflow ทุก breakpoint (คงจาก `72e822b`)
