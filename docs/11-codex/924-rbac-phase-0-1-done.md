# RBAC Restructure — Phase 0 + Phase 1 Done

**วันที่:** 2026-09-08
**Branch:** `fix/pilot-stability-followup` — ต่อจาก plan [923](923-rbac-phase-0-1-impl-plan.md), master plan [922](922-production-rbac-ux-restructure-plan.md)
**สถานะ:** Phase 0-1 เสร็จ · ยังไม่ push

---

## ทำอะไรไปแล้ว

### DB
- migration `0018_seed_role_permissions.sql` — ย้าย role→permission matrix เข้า `public.role_permissions` (source of truth), เพิ่ม permission keys ใหม่ (`change.*`, `incident.*`, `recovery.manage`, `org.manage`, `superadmin.access`) + `*` wildcard สำหรับ `super_admin`. apply ทั้ง local + cloud แล้ว. idempotent.

### Auth helpers (`apps/web/lib/auth/`)
| ไฟล์ | ทำอะไร |
|---|---|
| `role-model.ts` | pure: `PRIMARY_ROLE_ORDER`, `resolvePrimaryRole(roleKeys)`, `resolveRedirectPath(role)` — unit-tested 5 เคส |
| `nav-model.ts` | `NAV_SECTIONS` (โครงสร้าง nav 5 กลุ่ม) + `filterNav(sections, {permissions, roleKeys})` pure — unit-tested 4 เคส |
| `permissions.ts` | เพิ่ม `permissionsForRoles()` + `loadRolePermissions()` (อ่าน DB, fallback เป็น in-code matrix ที่ sync กับ `0018`) |
| `access.ts` | `getViewerAccess()` → `{ profile, roleKeys, permissions, primaryRole }` — เรียกครั้งเดียวใน shell |
| `current-user.ts` | resolve `roleLabel` จริง (ไทย) · `linkInvitedProfile()` — profile ที่ email ตรง + `auth_user_id` ว่าง → ผูกให้ตอน login |

### Auth flow
- `/auth/callback` — exchange code → ถ้ามี `next` param ปลอดภัย ไป `next`, ไม่งั้น `resolveRedirectPath(primaryRole)` (dispatcher→`/assignments`, operation_manager→`/mission-control`, planner/PM→`/projects`, organizer→`/portal`, super_admin/org_admin→`/`, ไม่มี role→`/no-access`)
- `/no-access` (ใหม่, public route) + `<AccessDenied>` component
- middleware: เพิ่ม `/no-access` ใน public prefixes

### Nav / shell
- `app-nav.tsx` → data-driven (`sections` prop, icon-name→component map) + จัดกลุ่มใหม่ (ปฏิบัติการ / วางแผน / ประสานงาน / องค์กร / ระบบ)
- `app-shell.tsx` → `async` server component, เรียก `getViewerAccess()` → `filterNav()` → ส่งลง nav ทั้ง desktop + mobile; เพิ่ม `<RoleBadge>` ใน footer
- **ลบ `<AuthGate>`** (client) + `<Suspense>` wrapper — middleware gate พอ, ลด loading flash
- `logout-button.tsx` — เพิ่ม `variant: "dark" | "light"`

### UX primitives
- `<PermissionGate anyPermission? anyRole? fallback?>` (server) — render children ถ้าผ่าน, ไม่งั้น `<AccessDenied>`
- `<EmptyState>`, `<Breadcrumb>`, `<RoleBadge>`

### Interim gating
- `/admin`, `/admin/*` (5 หน้า), `/live-test`, `/pilot-checklist` → ห่อ `<PermissionGate anyRole={["super_admin"]}>` (จน Phase 2 ย้ายเข้า `/superadmin`)

---

## Verify

- `npm run typecheck` · `npm run lint` · `npm test` (web 30, driver-core 14) เขียว
- `npm run build` — ✅ (ดู commit สุดท้าย)
- dev server: ทุก route 200; nav แสดงตาม role (dev fallback = `super_admin` เห็นครบ); 0 horizontal overflow

---

## ค้าง / Phase ต่อไป (ตาม [922](922-production-rbac-ux-restructure-plan.md))

| Phase | งาน |
|---|---|
| **2** | `/superadmin/*` layout + role gate · ย้าย `/live-test` `/admin/*` `/pilot-checklist` → `/superadmin/dev-tools/*` + `redirects()` · `/superadmin/users` ฟอร์มเพิ่มผู้ใช้ (pre-provision) |
| **3** | **data scoping** — `0019_rbac_rls_v2.sql` (`is_super_admin()` bypass, org-scope, drop `sprint2_*` ที่เหลือ, scoped policy drivers/vehicles/gps_locations) · `getScopedDataClient()` + เปลี่ยน `lib/data/*` read · create-project สร้าง `project_members` · แก้ `requirePermission` + ลบ escape hatch · RLS test suite · `scripts/seed-test-users.mjs` |
| **4** | workspace UX + error-reduction patterns (`<OwnerTag>` `<ContactStrip>` `<ConflictWarning>` `<ReadinessGate>` `<ChangeRequestButton>` `<ConfirmImpactDialog>` `<NotificationCard>`), `/portal`, dispatch fluency |
| **5** | superadmin depth, `/coordinator` `/vendor` เต็ม |

## วิธี test negative (ยังทำไม่ได้เต็มที่)

Phase 0-1 verify ได้แค่ positive (dev fallback = super_admin). test ว่า dispatcher เห็นเมนูน้อยกว่า / เข้า `/admin` ไม่ได้ → ต้องมี seeded users (Supabase Auth session จริง) — ทำใน Phase 3 พร้อม `scripts/seed-test-users.mjs`. ระหว่างนี้ตั้ง `TOMP_ALLOW_AUTH_FALLBACK` ปิด + login ด้วยบัญชีจริงที่ assign role ต่าง ๆ ผ่าน SQL / (Phase 2) `/superadmin/users`
