# Phase F — RBAC v3 (single-org) + project flow + purge fix · Done

**วันที่:** 2026-09-08 · plan `~/.claude/plans/frolicking-herding-hennessy.md`

## ทำอะไรไปแล้ว

### F1 — migration `0021_rbac_v3_single_org.sql` (apply local + cloud)
- `prevent_timeline_event_mutation()` — อนุญาต DELETE เมื่อ `current_setting('tomp.allow_timeline_purge') = 'on'`
- **`purge_smoke_test_data()`** SECURITY DEFINER (service_role) — ลบแถว `metadata.smokeTest` + timeline_events ที่ผูก · **รันบน prod แล้ว: ลบ 4 project / driver / vehicle / profile / org + 30 timeline_events** → prod เหลือ 0 project, admin จริง 1 คน
- `can_read_project` / `rbac_select_projects` / `rbac_select_drivers` / `rbac_select_vehicles` — **ตัด org branch** (single org = ทุก member เห็น driver/vehicle ทุกคัน — เป็น bug)
- reseed `role_permissions`: super_admin(`*`) + project_manager(13) + dispatcher(8) + coordinator(4) + customer_viewer(4) · 5 role เดิม (organization_admin, operation_manager, planner, vendor, organizer) ไม่มี permission

### F2 — app RBAC 2 ชั้น
- `permissions.ts` `ROLE_PERMISSIONS` = 6 role · `GLOBAL_PERMISSIONS` ตัด `org.manage`
- `role-model.ts` `PRIMARY_ROLE_ORDER` = 6 · redirect: super_admin→`/`, PM/dispatcher/coordinator→`/projects`, customer_viewer→`/portal`
- `role-th.ts` เหลือ 6 label (customer_viewer → "ผู้ชมโครงการ")
- `invite-user-form.tsx` GLOBAL_ROLES = [super_admin] · PROJECT_ROLES = [project_manager, dispatcher, coordinator, customer_viewer]
- `portal/layout.tsx` + `nav-model.ts` เอา `organizer` ออก

### F3 — scoped reads ON by default
- `scoped-decision.ts` `scopedReadsFlagOn` → true เว้นแต่ `TOMP_SCOPED_READS=0` (กลับ default)

### F4 — project flow + guard
- `/projects/[projectId]` + `.../assignments` — `getProjectById` null → `<AccessDenied>` "คุณยังไม่ได้เป็นสมาชิกโครงการนี้"
- `/mission-control` + `/assignments` (standalone) — 0 project → `<EmptyState>` + ลิงก์ `/projects`
- `scripts/backfill-project-members.mjs` — owner ที่ยังไม่เป็น member → เพิ่มเป็น project_manager (prod: ไม่มีอะไรต้อง backfill)

### F5 — sidebar
- ชื่อระบบ ไม่ `truncate` แล้ว — wrap 2 บรรทัด

### F6 — purge wiring
- `purgeSmokeTestRows()` → `client.rpc("purge_smoke_test_data")` · `countSmokeTestRows` ใช้ `.filter("metadata->>smokeTest","eq","true")`

## Verify
- typecheck · lint · test (web 54/15, driver-core 14) · build — เขียว
- `purge_smoke_test_data()` รันบน prod สำเร็จ · `verify-rls.mjs` — [รันหลัง deploy]

## ค้าง → Phase G (driver ↔ mission-control operational flow)
1. GPS ในศูนย์ควบคุมไม่ตรงจริง
2. หน้าคนขับ checklist ก่อนรับงาน (ตอนนี้ optional — user อยากให้เห็น)
3. สถานะจากคนขับไม่ถึงศูนย์ / 4. ข้อความจากศูนย์ไม่ถึงคนขับ
5. `/resources/vehicles/[id]` → 404 (`getVehicleOperationProfileById` คืน null)
6. หน้าคนขับ — 1 หน้าจอไม่ต้อง scroll: จุดรับส่ง + ไฟสถานะ GPS + ตำแหน่ง + ปุ่มสื่อสารทันที (+ พิมพ์ได้) + งานวันนี้
7. background GPS → native app (`apps/mobile-driver`)

## Backlog
- org CRUD + occasional-use admin URL
- `/coordinator` `/vendor` `/changes` · role-matrix editor · `<UndoToast>` · `scripts/ui-smoke.mjs`
