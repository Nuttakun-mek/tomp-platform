# RBAC Restructure — Phase 5a Done (Superadmin depth)

**วันที่:** 2026-09-08
**Branch:** `fix/pilot-stability-followup` — plan [931](931-rbac-phase-5-superadmin-plan.md), master [922](922-production-rbac-ux-restructure-plan.md)
**สถานะ:** Phase 5a เสร็จ · ยังไม่ push

---

## ทำอะไรไปแล้ว

### `lib/superadmin/overview.ts` (service-role — superadmin เห็นข้าม scope)
- `buildRoleMatrix(rows)` — pure, tested — flat (role,permission) → matrix
- `listRolePermissionMatrix()` — `role_permissions` join → `{ roles, permissions, grid }`
- `listOrganizationsWithCounts()` — org + นับ project/member (นับใน JS)
- `listAllProjects()` — project ทุก org + org name + owner name + active member count
- `listRecentAuditEvents(limit)` — `timeline_events` ล่าสุด + project/actor name map

### 4 หน้าใหม่ใต้ `/superadmin/*` (+ 4 แท็บใน `SuperadminShell`)
| route | เนื้อหา |
|---|---|
| `/superadmin/roles` | `<RoleMatrix>` — ตาราง role × permission, `*` = แถบ "ทุกสิทธิ์", scroll แนวนอน, คอลัมน์บทบาท sticky |
| `/superadmin/organizations` | การ์ด org + นับโครงการ/สมาชิก |
| `/superadmin/projects` | ตารางโครงการข้าม org: code (ลิงก์) · org · สถานะ · เจ้าของ · สมาชิก |
| `/superadmin/audit` | `<AuditFeed>` — 100 event ล่าสุดข้ามโครงการ: `formatTimelineEventTh` · โครงการ · actor · `formatRelativeTh` · เหตุผล |

ทุกหน้า = server component, gate ผ่าน `/superadmin/layout.tsx` เดิม (super_admin), service-role read.

---

## Verify
- typecheck · lint · test (web + overview.test.ts 2, driver-core 14) · build — เขียว
- `curl /superadmin/{roles,organizations,projects,audit}` = 200

---

## ค้าง → Phase 5b

| งาน |
|---|
| role matrix **แก้ไขได้** (toggle → write `role_permissions` + audit) |
| `/superadmin/organizations` create/rename · `/superadmin/projects` เพิ่ม/ลบ member ข้าม org |
| `/coordinator` (mobile) · `/vendor` · `/changes` เต็มรูปแบบ |
| RLS **write** policies (ตอนนี้ write = service-role + requirePermission) |
| `<UndoToast>` toast system + optimistic/rollback · command palette |
| `<ContactStrip>` / `<ReadinessGate>` hard-gate / `<ChangeRequestButton>` wiring (Phase 4b) |
| เปิด `TOMP_SCOPED_READS=1` บน prod (staging test ก่อน) |

## หมายเหตุ
- `npm run build` ต้องหยุด dev + `rm -rf apps/web/.next` ก่อนเสมอ (rename race `.next/export/500.html` บน Windows — clean retry ผ่าน)
