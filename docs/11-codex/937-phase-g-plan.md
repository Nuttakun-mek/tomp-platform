# Phase G — Driver ↔ Mission Control operational data flow

> superpowers:executing-plans — task-by-task, verify, commit + deploy per task.

**Goal:** สิ่งที่คนขับส่ง (สถานะ, ตำแหน่ง) ขึ้นศูนย์ควบคุมจริง · ข้อความจากศูนย์ถึงคนขับ · หน้าคนขับ 1 หน้าจอไม่ต้อง scroll · vehicle detail ไม่ 404

## ปัญหาที่พบ (จากการตรวจโค้ด)

| # | อาการ | สาเหตุ |
|---|---|---|
| G1 | สถานะจากคนขับไม่ถึงศูนย์ | MC อ่านสถานะงานจาก **metadata ของ GPS ping** เท่านั้น (`live-location-map.tsx:251`) ไม่ได้อ่านตาราง `assignment_status_updates` |
| G2 | ข้อความจากศูนย์ไม่ถึงคนขับ | หน้าคนขับเป็น server component ไม่มี realtime/polling → เห็นเฉพาะตอนรีเฟรช · MC `<DriverNotificationConsole />` ไม่ส่ง prop เลย (default `[]`) ไม่แสดงข้อความที่ส่งไป |
| G3 | GPS ในศูนย์ไม่ตรงจริง | `getLatestDriverLocationsByProjectId` dedup by assignment + enrichment — ต้องตรวจ (อาจ cache / stale / เอา record ผิด) |
| G4 | `/resources/vehicles/[id]` → 404 | `getVehicleOperationProfileById` สร้าง profile เฉพาะรถที่อยู่ใน assignment ในโครงการที่เห็น — รถไม่มีงาน = null = `notFound()` |
| G5 | checklist ก่อนรับงานหาย | Phase D ทำเป็น optional/collapsed — user อยากให้แสดง (ย่อได้) |
| G6 | หน้าคนขับต้อง scroll | `<DriverTaskView>` 6+ ส่วน |

---

## Tasks

### G1 — สถานะคนขับ → ศูนย์ควบคุม
- `lib/data/assignments.ts` (หรือใหม่ `lib/data/assignment-status.ts`) — `getLatestAssignmentStatuses(projectId)` อ่าน `assignment_status_updates` group by assignment → status ล่าสุด + เวลา + source
- `mission-control/page.tsx` — ส่งเข้า `<AssignmentMonitor>` / `<FleetBoard>` → แสดง badge สถานะจริง + "อัปเดตโดยคนขับ • <เวลา>" (ไม่พึ่ง GPS metadata)
- `<OwnerTag>` style: "ยืนยันโดย: คนขับ · N นาทีที่แล้ว"

### G2 — ข้อความ ศูนย์ ↔ คนขับ (2 ทาง) + realtime
- **ศูนย์ส่ง**: `mission-control/page.tsx` — `getDriverNotificationsByProjectId(projectId)` (ใหม่ใน `driver-operations.ts`) → `<DriverNotificationConsole notifications={...} />` แสดงประวัติ + ปุ่มส่งใหม่ (ยกจาก `vehicle-message-form`)
- **คนขับรับ**: `<DriverTaskView>` เพิ่ม client polling ทุก 15 วิ — `GET /api/driver/updates?token=` คืน `{ notifications, routeChanges, assignmentStatus }` (route ใหม่, token-auth) → อัปเดต state ในหน้า ไม่ต้องรีเฟรช
- **คนขับส่งข้อความอิสระ**: ปุ่ม "ส่งข้อความหาศูนย์" ใน `<DriverTaskView>` → `driverIssueReportAction` (issueType `message`, severity `info`) → โผล่ใน MC exception feed
- verify: ส่งข้อความจาก MC → เห็นในหน้าคนขับภายใน 15 วิ (ไม่รีเฟรช) และกลับกัน

### G3 — GPS accuracy ในศูนย์ควบคุม
- ตรวจ `getLatestDriverLocationsByProjectId` + `enrichLocationMetadata`:
  - เอา record ล่าสุดจริง (order `recorded_at desc` ต่อ assignment) ไม่ใช่ `created_at`
  - GPS หาย > 2 นาที → หมุดสีเทา + ป้าย "ขาดสัญญาณ • <เวลาล่าสุด>" (ไม่ใช่หายไปเลย/ตำแหน่งเก่าเงียบ ๆ)
  - แสดง accuracy (เมตร) บนหมุด
- `live-location-map.tsx` / `live-location-map` panel — timestamp + accuracy ชัดเจน

### G4 — vehicle detail 404
- `getVehicleOperationProfileById(id)` — ถ้าไม่เจอใน profiles → fallback `getVehicles().find(v => v.id === id)` → คืน profile เปล่า (0 งาน) แทน null
- หน้าเดียวกันแสดง "รถคันนี้ยังไม่มีงาน" แทน 404

### G5 + G6 — หน้าคนขับ 1 หน้าจอ
ออกแบบ `<DriverTaskView>` ใหม่ให้พอดี 1 จอมือถือ (ไม่ scroll ในสถานะปกติ):
```
┌─────────────────────────────┐
│ Call Sign · โครงการ   [●พร้อม] │  ← ไฟสถานะ GPS (เขียว/เหลือง/แดง)
│ รับ: <จุดรับ>                 │
│ ส่ง: <จุดส่ง> · <เวลา>         │
│ [ นำทาง Google Maps ]  (ใหญ่)  │
├─────────────────────────────┤
│  ปุ่มหลัก (state)              │
│  พร้อมรับงาน / แชร์ GPS / …    │
├─────────────────────────────┤
│ [โทรศูนย์] [ข้อความ] [แจ้งปัญหา]│  ← สื่อสารทันที 1 แถว
└─────────────────────────────┘
▸ งานวันนี้ (N)      ← collapsible
▸ Checklist ก่อนรับงาน  ← collapsible (G5 — กลับมาแต่ย่อ)
```
- ไฟสถานะ GPS: เขียว = แชร์อยู่+ล่าสุด < 30 วิ · เหลือง = > 30 วิ · แดง = ไม่แชร์/ขาดสัญญาณ
- "งานวันนี้" — `getAssignmentsByProjectId` filter คนขับคนนี้ + วันนี้ → รายการสั้น ๆ กดดูได้
- ปุ่ม "ข้อความ" เปิด sheet พิมพ์ได้ (G2)
- Checklist (G5): ยืนยันชื่อ/เบอร์/รถ/GPS — 4 ช่อง ย่อไว้ ติ๊กแล้วค่อยเปิดใช้ปุ่ม "พร้อมรับงาน" (soft — เตือนแต่ไม่ block)

### G7 — regression + handoff
typecheck/lint/test/build · smoke:production · handoff `938` · deploy

---

## Backlog (ยังไม่ทำ)
- native driver app + background GPS (`apps/mobile-driver`) — งานใหญ่แยก
- realtime แบบ Supabase channel (ตอนนี้ใช้ polling 15 วิ พอ)
