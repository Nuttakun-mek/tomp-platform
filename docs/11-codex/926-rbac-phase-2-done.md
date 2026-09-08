# RBAC Restructure — Phase 2 Done

**วันที่:** 2026-09-08
**Branch:** `fix/pilot-stability-followup` — plan [925](925-rbac-phase-2-impl-plan.md), master [922](922-production-rbac-ux-restructure-plan.md)
**สถานะ:** Phase 2 เสร็จ · ยังไม่ push

---

## ทำอะไรไปแล้ว

### Superadmin section (`/superadmin/*`)
- **`app/superadmin/layout.tsx`** — gate ด้วย `getViewerAccess().roleKeys.includes("super_admin")`; ไม่ใช่ → `<AccessDenied>`
- **`<SuperadminShell>`** — แถบ "พื้นที่ภายในสำหรับทีมแพลตฟอร์มเท่านั้น" (สีม่วง pilot) + sub-nav 3 แท็บ (ภาพรวม / ผู้ใช้และสิทธิ์ / เครื่องมือพัฒนา)
- **`/superadmin`** landing — 2 การ์ด (ผู้ใช้, เครื่องมือพัฒนา)

### ย้าย dev/test tools → `/superadmin/dev-tools/*`
| เดิม | ใหม่ |
|---|---|
| `/live-test` | `/superadmin/dev-tools/live-test` |
| `/admin` | `/superadmin` (redirect) |
| `/admin/pilot-smoke-test` | `/superadmin/dev-tools/smoke-test` |
| `/admin/data-quality` | `/superadmin/dev-tools/data-quality` |
| `/admin/enterprise-readiness` | `/superadmin/dev-tools/readiness` |
| `/admin/operations` | `/superadmin/dev-tools/runbook` |
| `/pilot-checklist` | `/superadmin/dev-tools/pilot-checklist` |

- ลบ `apps/web/app/{admin,live-test,pilot-checklist}/` — `next.config.ts` `redirects()` map ทุก path เก่า → ใหม่ (307)
- `/superadmin/dev-tools` landing จัดกลุ่ม 6 เครื่องมือ
- component (`components/admin/*`, `components/pilot/*`) + lib (`lib/admin/data-quality`) **คงที่เดิม** — แค่ page ย้าย
- ลบปุ่ม/ลิงก์ `/live-test` ออกจาก UI ฝั่ง operator: assignments header, home hero (→ "ดูโครงการทั้งหมด"), quick-action-panel (→ "ตรวจทรัพยากร"), mission-control decision-panel (→ "เปิดพื้นที่โครงการ"), driver error page
- `error.tsx` / `not-found.tsx` → ลิงก์ `/` แทน admin route เก่า

### `/superadmin/users` — เพิ่มผู้ใช้ + กำหนดบทบาท
- `lib/superadmin/users.ts` — `validateProvisionInput()` (pure, tested 4), `listProfilesWithRoles()`, `provisionUser()` (สร้าง `profiles` status `invited` + `user_role_assignments`/`project_members`)
- `app/actions/superadmin-users.ts` — `provisionUserAction` เช็ค `requirePermission("admin.manage_users")`
- `<InviteUserForm>` (email · ชื่อ · องค์กร · บทบาทองค์กร · โครงการ+บทบาทโครงการ) + `<UserList>` (status + role chips + EmptyState)
- `requirePermission` — honor dev fallback สำหรับ global check (consistent กับ `canCreateProject`)

---

## Verify
- `npm run typecheck` · `npm run lint` · `npm test` (web 34, driver-core 14) · `npm run build` — เขียว
- dev: `/superadmin`, `/superadmin/users`, `/superadmin/dev-tools/*` = 200; `/live-test` → 307 → new path; 0 horizontal overflow
- flow เพิ่มผู้ใช้: ยัง test เต็มไม่ได้บน cloud (production data ถูกล้าง → org dropdown ว่างจนกว่าจะ bootstrap; local มี org จาก seed)

---

## ค้าง / Phase ต่อไป

| Phase | งาน |
|---|---|
| **3** (ใหญ่สุด) | data scoping — `0019_rbac_rls_v2.sql` (`is_super_admin()` bypass, org-scope, drop `sprint2_*` ที่เหลือ, scoped policy drivers/vehicles/gps_locations) · `getScopedDataClient()` + เปลี่ยน `lib/data/*` read (flag `TOMP_SCOPED_READS`) · create-project สร้าง `project_members` + `owner_profile_id` · แก้ escape hatch `mode !== "service_role"` ใน `actions/projects.ts` · RLS test suite + `scripts/seed-test-users.mjs` |
| **4** | workspace UX + error-reduction (`<OwnerTag>` `<ContactStrip>` `<ConflictWarning>` `<ReadinessGate>` `<ChangeRequestButton>` `<ConfirmImpactDialog>` `<NotificationCard>`), `/portal`, dispatch fluency, `<ProjectScopePill>` + scope switcher |
| **5** | `/superadmin/roles` matrix editor · `/superadmin/organizations` · `/superadmin/projects` (cross-org member mgmt) · `/superadmin/audit` · `/coordinator` `/vendor` `/changes` เต็ม · command palette |

## หมายเหตุ
- `npm run build` ขณะ dev server รันอยู่ → `.next` ชนกัน (`Cannot find module './XXXX.js'`) → หยุด dev + `rm -rf apps/web/.next` ก่อน build เสมอ
