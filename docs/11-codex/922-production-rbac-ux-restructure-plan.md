# Production RBAC + UX/UI Restructure — Plan

**วันที่:** 2026-09-08
**สถานะ:** วางแผน (ยังไม่ลงมือ) — รอ review ก่อนแตกเป็น implementation plan
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

หลัก: **ทุกหน้าตอบคำถามปฏิบัติการ 1 ข้อ · เน้น exception/readiness · ลด text density · empty state = onboarding**

| workspace | หน้าแรก | หน้าจอหลัก | สิ่งที่ **ไม่** เห็น |
|---|---|---|---|
| Operation Manager | `/operations` command center | Readiness Board · Mission Control · Timeline · Incident · Recovery | superadmin, org settings |
| Planner / PM | `/projects` | Project setup · Mission editor · Assignment planner · Publish review | dispatch live actions, superadmin |
| Dispatcher | `/dispatch` | Dispatch lanes · Call Sign · QR · driver/vehicle assign · status | project create/publish, org settings |
| Coordinator | `/coordinator` | งานที่ได้รับ (scoped) · ยืนยัน arrival/boarding/completion · แจ้งปัญหา | โครงการอื่น, resource pool, planning |
| Organizer / Customer | `/portal` | ภาพรวมโครงการ (permitted) · สถานะ mission · change request · อัปโหลดเอกสาร | ข้อมูลคนขับ, GPS ดิบ, dispatch |
| Vendor | `/vendor` | คนขับ/รถ ของตัวเอง · availability · replacement request | โครงการ, GPS, assignment ของ vendor อื่น |
| Driver | `/driver` (QR, มีแล้ว) | assignment card · route sheet · GPS share · issue report | ทุกอย่างนอกงานตัวเอง |

**Phase นี้ทำจริงแค่:** shell + nav filtering + `/operations`,`/dispatch`,`/projects`,`/portal(min)`,`/no-access`,`/superadmin` — ที่เหลือ (`/coordinator`, `/vendor` เต็ม) เป็น backlog

### 2.10 Design-system (ต่อยอดจาก `72e822b`)

- คง type scale / tokens / `.page-grid` เดิม
- เพิ่ม: `<WorkspaceSwitcher>`, `<PermissionGate>` (client + server), `<RoleBadge>`, `<EmptyState>`, `<AccessDenied>`
- Superadmin layout: reuse shell แต่ palette เข้ม + `data-area="superadmin"`

---

## 3. Rollout phases

> ทุก phase: typecheck + lint + test เขียว, ไม่ push จนกว่าจะ review

### Phase 0 — เตรียม (ไม่กระทบผู้ใช้)
1. เขียน `getUserPrimaryRole()` + `getAccessibleWorkspaces()` ใน `lib/auth/`
2. migration `0018_seed_role_permissions.sql` (ย้าย matrix เข้า DB)
3. `lib/auth/permissions.ts` → DB loader + fallback
4. RLS test harness + seed users script

### Phase 1 — Auth flow + nav gating (กระทบ: nav เปลี่ยน)
5. `/auth/callback` → resolve role → redirect map (§2.4)
6. `/no-access` page
7. `app-nav.tsx` → permission-filtered (server component ส่ง permission list ลง client)
8. ลบ `AuthGate` (เหลือ middleware)
9. `getCurrentUserProfile().roleLabel` → resolve จริง

### Phase 2 — Superadmin section + ย้าย test tools (กระทบ: URL test tools เปลี่ยน)
10. `/superadmin/layout.tsx` + role gate
11. ย้าย `/live-test`, `/admin/*`, `/pilot-checklist` → `/superadmin/dev-tools/*` + redirect เก่า
12. `/superadmin/users` (v1: list + assign role) — ปลดล็อกให้ไม่ต้องยิง SQL
13. `/superadmin/dev-tools` landing

10b. `/auth/callback` → auto-link profile ที่ `status='invited'` ด้วย email (§2.4b)
12b. `/superadmin/users` → ฟอร์ม "เพิ่มผู้ใช้" (pre-provision profile + role)

### Phase 3 — Data scoping (RLS) (กระทบสูงสุด — ต้องมี RLS test ผ่านก่อน)
14. migration `0019_rbac_rls_v2.sql` **ก่อน** (super_admin `is_super_admin()` bypass, org-scope, drop `sprint2_*` ที่เหลือ, resource tables) — ทดสอบ RLS ผ่านก่อน
15. `getScopedDataClient()` + เปลี่ยน `lib/data/*` read functions (หลัง flag `TOMP_SCOPED_READS=1`)
16. แก้ create-project ให้สร้าง `project_members` + set `owner_profile_id`
17. แก้ `requirePermission` + ลบ escape hatch `mode !== "service_role"`
18. RLS test suite ผ่านครบ → เปิด flag ทีละ env

### Phase 4 — Workspace UX (กระทบ: nav grouping + home)
19. จัดกลุ่ม nav ใหม่ (§2.3) — คง route path เดิม
20. `/portal` (organizer/customer read-only v1 — decision #3)
21. home `/` ปรับ section ตาม permission
22. `<ProjectScopeSwitcher>` + scope cookie

### Phase 5 — Superadmin depth + workspace เต็ม (backlog)
23. `/superadmin/roles` matrix editor · `/organizations` · `/projects` · `/audit`
24. `/coordinator`, `/vendor`, `/changes` เต็มรูปแบบ

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
apps/web/components/app-nav.tsx             permission-filtered
apps/web/components/app-shell.tsx           + ProjectScopeSwitcher, ลบ AuthGate
apps/web/components/auth/**                 + PermissionGate, RoleBadge, AccessDenied
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
