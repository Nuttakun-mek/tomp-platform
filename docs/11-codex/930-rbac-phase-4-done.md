# RBAC Restructure — Phase 4 Done (Workspace UX + error-reduction)

**วันที่:** 2026-09-08
**Branch:** `fix/pilot-stability-followup` — plan [929](929-rbac-phase-4-impl-plan.md), master [922](922-production-rbac-ux-restructure-plan.md)
**สถานะ:** Phase 4 (core) เสร็จ · ยังไม่ push

---

## ทำอะไรไปแล้ว

### primitive UI ใหม่ (`components/ui/`)
| component | ใช้ทำอะไร |
|---|---|
| `<OwnerTag name roleKey? at?/>` | "ชื่อ · บทบาท · 5 นาทีที่แล้ว" — ทุก object ปฏิบัติการมีเจ้าของที่มองเห็น; ไม่มี name → "ยังไม่ระบุผู้รับผิดชอบ" (เผยช่องว่าง) |
| `<ContactStrip contacts/>` | contact matrix — ปุ่ม `tel:` / `sms:` ต่อคน; ทุกหน้า operational เข้าถึงเบอร์ได้ |
| `<ConflictWarning conflicts/>` | แถบแดง inline เมื่อจองซ้อนเวลา |
| `<NotificationCard title body? tone? at? actionHref?/>` | การ์ดแจ้งเตือน = ข้อความ + เวลา + ปุ่ม action |

### pure helpers
- `lib/ui/relative-time.ts` — `formatRelativeTh(iso, now?)` (tested)
- `lib/ui/owner-line.ts` — `formatOwnerLine({name, roleKey, at})` (tested)
- `lib/domain/assignment-rules.ts` — `describeAssignmentConflicts(candidate, existing[])` → string[] ไทย (tested)

### wiring
- `exception-list` + `assignment-summary-card` → `<OwnerTag>`
- `create-assignment-form` → คำนวณ conflict live จาก assignment ที่มีอยู่ (driver/vehicle เดียวกัน) → `<ConflictWarning>` + textarea "เหตุผลการจองซ้อน" (บังคับก่อน submit; reason + conflicts เก็บใน `metadata`)
- `driver-notification-console` → render `DriverNotification[]` จริงผ่าน `<NotificationCard>` (เดิม hardcode 2 แถว)

### `/portal` — organizer/customer read-only
- `layout.tsx` gate: role `organizer` | `customer_viewer` | `super_admin` มิฉะนั้น `<AccessDenied>`
- `page.tsx`: `<PortalProjectCard>` (ต่อโครงการ: lifecycle badge + นับ mission ตามสถานะ) + `<PortalMissionStatus>` + `<ChangeRequestForm>` — **ไม่ fetch** GPS / drivers / resources
- nav มี `/portal` (filter role) อยู่แล้ว

### home `/` section-by-permission
- `getViewerAccess()` → fetch + render เฉพาะที่มี permission:
  - `assignment.read` → `<OperationsPulse>` + `<TodayOperationBoard>` (ไม่มี → EmptyState)
  - `driver.read` → GPS/locations (ไม่มี → ไม่ fetch, count = 0)
  - `project.read` → `<ReadinessOverview>`
  - `super_admin` → `<PilotProgressPanel>`
  - ไม่มี permission เลย → EmptyState "ติดต่อผู้ดูแลเพื่อรับบทบาท"

---

## Verify
- `npm run typecheck` · `lint` · `test` (web 52 / 14 files, driver-core 14) · `build` — เขียว

---

## ค้าง → Phase 4b / 5

| งาน | หมายเหตุ |
|---|---|
| `<ContactStrip>` wiring | สร้างแล้ว แต่ยังไม่ได้เสียบเข้า mission-control / dispatch / driver (ต้องมี contact data model ต่อ assignment) |
| Task 30 — dispatch fluency | bulk assign, keyboard `j/k/a//`, inline edit + `<SavePanel>`, saved filter — แยก plan |
| Task 31 — `<UndoToast>` + optimistic + rollback ทุก action | แยก plan (แตะทุก action) |
| `<ReadinessGate>` hard-gate + `<ConfirmImpactDialog>` ก่อน publish | มี `publish-readiness-panel` + `change-impact-summary` อยู่แล้ว — ยกระดับเป็น hard-gate |
| `<ChangeRequestButton>` แทนปุ่มแก้หลัง publish | ต้อง audit ทุกปุ่มแก้ |
| NotificationCard: project-level notification query | ตอนนี้ console รับ prop แต่ mission-control ยังไม่ส่ง (default []) |

## หมายเหตุ
- `formatWindowLabel` ใน `describeAssignmentConflicts` ใช้ local timezone — test เขียนแบบ tz-agnostic (regex)
- `npm run build` ต้องหยุด dev + `rm -rf apps/web/.next` ก่อนเสมอ
