# Phase K — evidence 10 MB, drop "องค์กร", MC overview redesign

User feedback (2026-09-08, round 6):
1. บีบอัดรูป + อัปได้ 10 MB
2. ผู้ใช้และสิทธิ์ ควรอยู่ส่วนเดียวกับ "ระบบ"
3. คำว่า "องค์กร" ควรหายไป
4. IA งง — ควรเป็น login → รายการโครงการ (+สร้าง/ลบ) → เข้าโครงการถึงเจอเครื่องมือ, แต่ละโครงการแยกข้อมูลกัน
5. คนขับกดสถานะงาน ไม่ขึ้นที่ศูนย์
6. แชทที่ศูนย์เรียงกลับหัว (ล่าสุดอยู่บน) — ควรเป็นล่าสุดอยู่ล่างแบบแอปแชท
7. 1 การ์ดใหญ่/คัน มีทุกอย่าง ปรับซ่อน-แสดงได้ · แผนที่ไม่ต้องมีรายละเอียดคนขับครบ (30 คันจะรก)
8. ข้อความจากคนขับ → มีสัญลักษณ์แจ้งเตือนบนหน้าจอรวม ให้ศูนย์ไปเปิดของคันนั้น
+ (mid-turn) ฝั่งคนขับต้องรองรับแอปมือถือ + หลายขนาดจอ

## Done

### K1 — evidence photos: compress + 10 MB
- `<DriverPhotoCheck>` compresses every photo (canvas → 1600 px → JPEG, drops
  quality in steps until < 1 MB). Accepts up to 10 MB of raw input.
- `checkin-photos.ts` ceiling 5 → 10 MB, accepts HEIC/HEIF.
- migration `0023` — `driver-evidence` + `driver-checkin-photos` buckets to 10 MB.

### K2 — drop "องค์กร" from the UI
- nav: the "องค์กร" section is gone; "ผู้ใช้และสิทธิ์" now sits in the **ระบบ**
  section next to "เครื่องมือระบบ" (was "Superadmin").
- `superadmin-shell` — removed the "องค์กร" tab.
- reworded every "องค์กร" string in `/superadmin/*` + `enterprise-readiness-panel`.
- `/superadmin/projects` — dropped the org column.

### K5/K7/K8-feedback — Mission Control overview
- `<FleetBoard>` — **one card per vehicle**, collapsible. Header: freshness dot,
  Call Sign, driver/plate, **driver-reported status** (green pill), GPS label, and
  a **red badge** (💬 N / ⚠ N) when the driver has sent messages/issues not yet
  opened. Cards with unread driver messages sort to the top; the panel title shows
  "N คันมีข้อความใหม่". Expanded card = phone (`tel:`), coords + Maps, plan status,
  seats, **recent driver messages inline**, evidence thumbnails.
- `<LiveLocationMap>` right column — removed the full per-driver detail list
  (unreadable with 30 vehicles). Now just counts + legend + a pointer to the
  fleet cards. Markers + popups unchanged.

### K6 — comms order
`<CommsConsole>` feed is now oldest→newest (newest at the bottom) and auto-scrolls
down, like a normal chat app.

### K3 — driver status → centre
Data path was already correct (rows are in `assignment_status_updates`; FleetBoard
reads `getLatestAssignmentStatuses`). Added a postgres fallback to that function and
made the reported status a prominent green pill on the fleet card. Most likely the
earlier report predates the Phase G/H deploy.

### mobile
`app/driver/layout.tsx` — `min-h-[100svh]`, `env(safe-area-inset-*)` padding,
`max-w-[520px]` single column (works from ~320 px). The driver screens are the
basis for the mobile-app webview.

## Not done this round — Phase L
- **Full project-centric IA** (item 4): after login → project list with create/delete →
  enter a project → its own workspace (mission control / assignments / resources /
  settings) scoped to that project, no global tool nav. This is a routing migration
  (`/mission-control` etc. → `/projects/[id]/...`) and deserves its own phase.

## Verify
typecheck 0 · lint 0 · web 54/15 · driver-core 14/5 · build `KBUILD=?` · `smoke:production`.
