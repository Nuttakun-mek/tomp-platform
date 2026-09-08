# RBAC Restructure — Phase 3 Done (Data scoping / RLS)

**วันที่:** 2026-09-08
**Branch:** `fix/pilot-stability-followup` — plan [927](927-rbac-phase-3-impl-plan.md), master [922](922-production-rbac-ux-restructure-plan.md)
**สถานะ:** Phase 3 เสร็จ · `TOMP_SCOPED_READS` **ยังไม่เปิดใน production** · ยังไม่ push

---

## ทำอะไรไปแล้ว

### DB — migration `0019_rbac_rls_v2.sql` + `0020_rbac_rls_v2_fixups.sql` (apply local docker + cloud)

- helper (SECURITY DEFINER, bypass RLS ภายใน): `current_profile_id()`, `current_org_id()`, `is_super_admin()`, `is_org_admin(uuid)`, `is_project_member(uuid)`, `can_read_project(uuid)`
- แทน `sprint2_authenticated_read_*` (using true) + `project_members_select_*` **ทุกตาราง** ด้วย policy ที่ scope:
  - `super_admin` (global `user_role_assignments`) → เห็นทุกอย่าง
  - `organization_admin` → เห็นทุก project + drivers/vehicles ใน org ตัวเอง
  - ที่เหลือ → เห็นเฉพาะ project ที่เป็น `project_members` active
  - `gps_locations` / driver-facing tables (checkins, issue_reports, access_tokens, packets, notifications...) → project member เท่านั้น + super_admin (ไม่มี org-wide)
  - `organizations` / `profiles` → org ตัวเอง + self + super_admin
- `0020` fix: `rbac_select_profiles` เดิม query `profiles` ใน USING ของตัวเอง → **infinite recursion**; เปลี่ยนไปใช้ `current_org_id()` helper

### Test — `scripts/seed-test-users.mjs` + `scripts/verify-rls.mjs` + `database/tests/rls_rbac_v2.sql`

- seed 4 auth user (idempotent, password `tomp-test-1234`): `super@` (global super_admin), `orgadmin@` (global org_admin), `pm1@` (project_manager @ TEST-A), `disp2@` (dispatcher @ TEST-B) + org + 2 project เปล่า
- `verify-rls.mjs` จำลอง JWT ต่อ user แล้ว assert visibility → **ALL PASS** (pm1 เห็นแค่ A, disp2 เห็นแค่ B, super เห็นหมด, org_admin เห็นทั้ง org)
- `scripts/.seed-test-users.json` (gitignored) เก็บ id ที่ seed ไว้

### App — `TOMP_SCOPED_READS` flag

- `lib/supabase/scoped-client.ts` — `getScopedDataClient()` (@supabase/ssr, ผูก cookie) + `resolveReadClient()` → ใช้ scoped client เฉพาะเมื่อ flag=`1` **และ** มี auth session จริง มิฉะนั้น service-role
- `lib/supabase/scoped-decision.ts` — pure predicate (unit tested)
- wired 8 `lib/data/*` read module (projects, missions, assignments, call-signs, resources, timeline, locations, driver-operations) → `resolveReadClient()`; **Postgres/demo fallback path ไม่แตะ** (ยัง bypass scope — known gap, dev + `TOMP_ENABLE_POSTGRES_FALLBACK=1` เท่านั้น)

### App — RBAC write path

- `requirePermission` — `GLOBAL_PERMISSIONS` (`project.create`, `admin.manage_users`, `org.manage`, `superadmin.access`) route ไป global+org role check เสมอ แม้ส่ง org/project id เข้ามา (fix bug deny-ทุกคน สำหรับ `project.create`)
- `createProjectAction` — ลบ escape hatch `mode !== "service_role"`; หลังสร้าง project → insert `project_members` (project_manager) ให้ผู้สร้าง + set `owner_profile_id` (ไม่งั้น RLS 0019 ซ่อน project ที่เพิ่งสร้างจากผู้สร้างเอง)

### UX — `<ProjectScopePill>`

- `components/workspace/project-scope-pill.tsx` (client) — pill บนสุด sidebar (dark) + mobile header (light): แสดง `รหัส · ชื่อโครงการ` ปัจจุบัน + dropdown เลือกโครงการอื่น (จากรายการที่ viewer เห็น) → set cookie `tomp_scope` + `router.refresh()`
- `lib/workspace/scope.ts` — `resolveActiveScope()` (pure, tested): cookie project ถ้ายังเห็น, ไม่งั้น project แรก
- `app-shell.tsx` โหลด `getProjects()` (scoped แล้ว) + อ่าน cookie → ส่งให้ pill

---

## Verify

- `npm run typecheck` · `lint` · `test` (web 44 / 12 files, driver-core 14) · `build` — เขียว
- `node scripts/verify-rls.mjs` — ALL PASS

---

## ค้าง / Phase ต่อไป

| งาน | หมายเหตุ |
|---|---|
| **เปิด `TOMP_SCOPED_READS=1`** | ทำใน `.env.local` แล้วทดสอบ manual (login จริง) ก่อน → staging → prod. ยังไม่เปิดใน repo/prod |
| Postgres/demo fallback ยัง bypass scope | dev + `TOMP_ENABLE_POSTGRES_FALLBACK=1` เท่านั้น; production ปิด fallback อยู่แล้ว |
| write RLS (INSERT/UPDATE scope) | ยังพึ่ง service-role + `requirePermission`; RLS write policy = Phase 5 |
| **Phase 4** | `/portal`, home section-by-permission, `<OwnerTag>`/`<ContactStrip>`/`<ConflictWarning>`/`<ReadinessGate>`/`<ChangeRequestButton>`/`<ConfirmImpactDialog>`/`<NotificationCard>`, dispatch fluency, `<UndoToast>` |
| **Phase 5** | `/superadmin/roles` matrix editor, `/superadmin/organizations`, `/superadmin/projects`, `/superadmin/audit`, `/coordinator`, `/vendor`, `/changes`, RLS write policies, command palette |

## หมายเหตุ

- `npm run build` ขณะ dev รัน → `.next` ชนกัน → หยุด dev + `rm -rf apps/web/.next` ก่อน build เสมอ
- seeded test users อยู่บน **cloud** — ลบด้วย `node scripts/seed-test-users.mjs --reset`
- migration runner (`apply-migrations.mjs`) ต่อ cloud ผ่าน pooler + TLS; local docker ใช้ `docker exec ... psql` (runner บังคับ `ssl:"require"`)
