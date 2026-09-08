# Phase D — Driver experience + test-data hygiene · Done

**วันที่:** 2026-09-08 · plan [934](934-phase-d-driver-and-hygiene-plan.md)

## ทำอะไรไปแล้ว

### D1 — แยกหน้าคนขับออกจาก AppShell
- route group `app/(app)/` มี `<AppShell>` layout · ย้าย 9 route folder เข้าไป (URL ไม่เปลี่ยน)
- `app/layout.tsx` เหลือแค่ `<html><body>` · `app/driver/layout.tsx` เบา ไม่มีเมนู
- `/login` `/no-access` `/auth` อยู่นอก shell ด้วย

### D2 — หน้าคนขับใหม่ `<DriverTaskView>` — 1 หน้าจอ 1 งาน
- หัว: โครงการ + Call Sign + สถานะ · การ์ดเส้นทาง จุดรับ→จุดส่ง + ปุ่ม Google Maps ใหญ่
- **ปุ่มหลักเดียว state machine**: `พร้อมรับงาน` (→ `driverCheckinAction` status ready) → `เริ่มแชร์ตำแหน่ง GPS` → `<DriverLocationShare>` + ปุ่ม ถึงจุดรับ/รับผู้โดยสาร/ส่งเสร็จ (`assignmentStatusUpdateAction`)
- ปุ่มรอง: แจ้งปัญหา (6 ประเภท, 2 แตะ) · โทรผู้ประสานงาน
- **ลบปุ่ม "กดรับทราบงาน" ที่ตาย** · checklist 6 ช่อง + รูปถ่าย → พับเป็น "รายละเอียดเพิ่มเติม (ไม่บังคับ)"
- `driver-card.tsx` เดิม (9 การ์ด) ไม่ใช้แล้ว

### D3 — QR + PIN 6 หลัก
- `lib/driver-access/token.ts` + `generateDriverPin` / `hashDriverPin` / `verifyDriverPin` (sha256 + `DRIVER_ACCESS_TOKEN_SECRET`)
- `createDriverAccessTokenAction` — สร้าง PIN, เก็บ `metadata.pinHash` + `pinAttempts`, return `pin`
- `<DriverAccessGenerator>` — แสดง PIN เด่นชัด (กล่องเหลือง) + เตือน "บอกแยกจาก QR"
- `verifyDriverPinAction` — เทียบ hash → ถูก: set cookie `dpin_<tokenId>` (httpOnly, 12 ชม.) · ผิด 5 ครั้ง → revoke token
- `app/driver/page.tsx` — `pinRequired` + ไม่มี cookie → `<DriverPinGate>` (ช่องกรอก 6 หลัก) · token เก่าไม่มี pinHash → ผ่านเลย

### D4 — ปุ่มล้างข้อมูลทดสอบ
- `/superadmin/dev-tools/purge-test-data` — นับ + ลบแถว `metadata->>smokeTest = 'true'` จาก projects/drivers/vehicles/profiles/organizations (cascade ลบลูก) · พิมพ์ "ล้างข้อมูลทดสอบ" ยืนยัน · super_admin เท่านั้น
- เพิ่มการ์ดใน `/superadmin/dev-tools` landing

### D5 — แก้เมนู 404
- เอา `/coordinator` `/vendor` `/changes` ออกจาก nav (ยังไม่มีหน้า) · `/org/members` → `/superadmin/users`

### เพิ่มเติม
- ชื่อระบบ → "TOMP — Transportation Operations Management Platform" / "ระบบบริหารจัดการการเดินทางและบริการ" (layout metadata, app-shell, command-header, login)
- หน้า `/login` → minimal: โลโก้ + ชื่อ + ฟอร์ม email/password เท่านั้น (ตัด marketing panel + role cards + ลิงก์คนขับ)

## Verify
typecheck · lint · test (web 54/15, driver-core 14) · build — เขียว

## ค้าง / รู้ไว้
- **Background GPS** — web app หยุดส่งตำแหน่งเมื่อปิดจอ/สลับแอป (ข้อจำกัด browser) → ต้องใช้ **native app** (`apps/mobile-driver` Expo มีอยู่ — ยังไม่ได้ต่อยอด)
- **Mobile UI test harness** — ยังไม่มี · เสนอ: `scripts/ui-smoke.mjs` (puppeteer) ถ่าย screenshot mobile+desktop + เช็ค console error / horizontal overflow ทุกหน้า
- `driver-card.tsx` + การ์ดเดิม (task-hero, next-action, emergency, acknowledgement, readiness-card...) ยังอยู่ในโค้ด — ลบทีหลังเมื่อมั่นใจ
