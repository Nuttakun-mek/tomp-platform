# Phase D — Driver experience + test-data hygiene

> superpowers:executing-plans — task-by-task, verify, commit + deploy per task.

**Goal:** คนข้บ scan QR → กรอก PIN → เห็นหน้าเดียว งานเดียว กด "พร้อมรับงาน" ได้จริง · ไม่เห็นเมนูแอป · ทีมแพลตฟอร์มล้างข้อมูลทดสอบได้ · ไม่มีเมนูที่กดแล้ว 404

**Decisions:** QR + PIN 6 หลักต่อ QR · ทำ D1–D5 ตามลำดับ commit+deploy ทีละงาน

## Global Constraints
- ห้าม build ขณะ dev รัน; `rm -rf apps/web/.next` ก่อน build
- typecheck + lint + test เขียวทุก task ก่อน push
- `git push origin main` = auto-deploy production
- Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

---

## D1 — แยกหน้าคนขับ/login ออกจาก AppShell (route group)

**Files:** `app/layout.tsx` (bare), new `app/(app)/layout.tsx` (AppShell), `git mv` route folders → `app/(app)/`

- [ ] 1. `app/(app)/layout.tsx` ใหม่ → `export default ({children}) => <AppShell>{children}</AppShell>`
- [ ] 2. `app/layout.tsx` → เหลือแค่ `<html lang="th"><body class={font}>{children}</body></html>` + metadata/viewport (ลบ import AppShell)
- [ ] 3. `git mv` เข้า `app/(app)/`: `page.tsx` (home), `assignments/`, `mission-control/`, `projects/`, `project/`, `portal/`, `recovery/`, `resources/`, `superadmin/`
- [ ] 4. คงไว้ที่ root: `driver/`, `login/`, `no-access/`, `auth/`, `api/`, `actions/`, `error.tsx`, `not-found.tsx`, `globals.css`
- [ ] 5. `driver/` — เพิ่ม `app/driver/layout.tsx` เบา ๆ (พื้นหลัง canvas + max-width) ไม่มีเมนู
- [ ] 6. verify: typecheck + build + `curl` ทุก URL เดิม 200 (route group ไม่เปลี่ยน path) + `/driver?token=` ไม่มี sidebar
- [ ] 7. commit `refactor(app): route group — driver/login/no-access outside AppShell`

---

## D2 — หน้าคนขับใหม่: 1 หน้าจอ 1 งาน

**Files:** new `components/driver/driver-task-view.tsx`; `app/driver/page.tsx` ใช้ตัวใหม่; ลบ/ยุบ `driver-card.tsx` + การ์ดที่ซ้ำ

- [ ] 1. `<DriverTaskView driverAccess>` (client) — โครงสร้าง:
  - **หัว**: Call Sign · ชื่อโครงการ · สถานะปัจจุบัน (badge)
  - **เส้นทาง**: จุดรับ → จุดส่ง · เวลานัด · ปุ่มใหญ่ "เปิด Google Maps"
  - **ปุ่มหลักเดียว** (state machine):
    - `assigned` → "พร้อมรับงาน" → เรียก `driverCheckinAction({status:"ready", gpsConsent:true, confirmed*:true})` → state `ready`
    - `ready` → "เริ่มแชร์ตำแหน่ง GPS" → เปิด `DriverLocationShare` flow → state `sharing`
    - `sharing` → แสดง "กำลังแชร์ตำแหน่ง" + ปุ่ม "ถึงจุดรับแล้ว" / "รับผู้โดยสารแล้ว" / "ส่งเสร็จ" (`assignmentStatusUpdateAction`)
  - **ปุ่มรอง**: "แจ้งปัญหา" (เปิด sheet เลือกประเภท + ส่ง `driverIssueReportAction`) · "โทรผู้ประสานงาน" (`tel:`)
  - **ล่างสุด (พับได้)**: แจ้งเตือน + route change ถ้ามี
- [ ] 2. ลบปุ่ม "กดรับทราบงาน" ที่ตาย (`driver-assignment-acknowledgement.tsx`) — รวมเป็น state `ready`
- [ ] 3. checklist 6 ช่อง + รูปถ่าย → ย้ายเป็น "รายละเอียดเพิ่มเติม (ไม่บังคับ)" พับไว้ ไม่ block ปุ่มหลัก
- [ ] 4. `app/driver/page.tsx` → `<DriverTaskView>` แทน `<DriverCard>`
- [ ] 5. verify + screenshot มือถือ (390px) + commit `feat(driver): single-screen task view with one primary action`

---

## D3 — QR + PIN 6 หลัก

**Files:** `lib/driver-access/token.ts` (+ pin helpers), `app/actions/driver-access.ts`, new `app/actions/driver-pin.ts`, `components/driver/driver-access-generator.tsx`, `app/driver/page.tsx` (+ PIN gate), new `components/driver/driver-pin-gate.tsx`

- [ ] 1. `lib/driver-access/token.ts` — `generateDriverPin()` → 6 หลัก, `hashDriverPin(pin)` (sha256 + secret), `verifyDriverPin(pin, hash)`
- [ ] 2. `createDriverAccessTokenAction` — สร้าง PIN, เก็บ `metadata.pinHash` + `metadata.pinAttempts:0`, return `pin` ใน result
- [ ] 3. `<DriverAccessGenerator>` — แสดง **PIN เด่นชัด** ข้าง QR + ข้อความ "บอกคนขับแยกช่องทาง อย่าส่งพร้อม QR"
- [ ] 4. `driver-pin.ts` — `verifyDriverPinAction({token, pin})`: hash token → หา row → เทียบ pinHash → ถูก: set cookie `dpin_<tokenId>` (httpOnly, signed, 12 ชม.) → ผิด: `pinAttempts++`, เกิน 5 → revoke token
- [ ] 5. `app/driver/page.tsx` — token valid + ไม่มี cookie `dpin_<tokenId>` → render `<DriverPinGate token>` (ช่องกรอก 6 หลัก) แทน task view
- [ ] 6. เก่าที่ไม่มี pinHash (สร้างก่อนฟีเจอร์นี้) → ผ่านเลย (backward compat)
- [ ] 7. verify + commit `feat(driver): QR + 6-digit PIN verification`

---

## D4 — ปุ่มล้างข้อมูลทดสอบ

**Files:** new `app/(app)/superadmin/dev-tools/purge-test-data/page.tsx`, `lib/superadmin/purge-test-data.ts`, `app/actions/superadmin-purge.ts`; `dev-tools` landing เพิ่มการ์ด

- [ ] 1. `lib/superadmin/purge-test-data.ts` — `countSmokeTestRows()` + `purgeSmokeTestRows()` — ลบ `where metadata->>'smokeTest' = 'true'` ตามลำดับ FK-safe (จาก `reset-production-data.mjs` BUSINESS_TABLES) ผ่าน service-role; คืนจำนวนที่ลบต่อตาราง
- [ ] 2. `app/actions/superadmin-purge.ts` — `purgeTestDataAction({confirm})` — `requirePermission("superadmin.access")` หรือ role super_admin, ต้อง `confirm === "ล้างข้อมูลทดสอบ"`
- [ ] 3. หน้า `/superadmin/dev-tools/purge-test-data` — แสดงจำนวนแถว smokeTest ต่อตาราง + ช่องพิมพ์ยืนยัน + ปุ่มแดง
- [ ] 4. `dev-tools` landing — เพิ่มการ์ด "ล้างข้อมูลทดสอบ"
- [ ] 5. verify + commit `feat(superadmin): purge smoke-test data (metadata.smokeTest)`

---

## D5 — แก้เมนู 404

**Files:** `lib/auth/nav-model.ts` (+ `.test.ts`)

- [ ] 1. เอา item `/coordinator`, `/vendor`, `/changes` ออกจาก `NAV_SECTIONS` (ยังไม่มีหน้า — ใส่กลับเมื่อสร้าง Phase 5b)
- [ ] 2. `/org/members` → เปลี่ยน href เป็น `/superadmin/users` (หรือเอาออก ให้เข้าผ่าน superadmin tab)
- [ ] 3. อัปเดต `nav-model.test.ts` ให้ตรง
- [ ] 4. verify + commit `fix(nav): drop menu items with no page yet (coordinator/vendor/changes)`

---

## D6 — regression + handoff
- [ ] typecheck + lint + test + build + `smoke:production` เขียว
- [ ] `curl` prod: ไม่มี 404 จากเมนู · `/driver?token=` ไม่มี sidebar
- [ ] handoff `935-phase-d-done.md` + อัปเดต memory
- [ ] commit `docs: Phase D done`

## Self-review
- route group `(app)` ไม่เปลี่ยน URL — internal `<Link href>` ทั้งหมดไม่ต้องแก้
- `git mv` ต้องระวัง path ใน `next.config.ts` redirects (`/live-test` → `/superadmin/dev-tools/*` ยังใช้ได้ เพราะ path เดิม)
- `vercel.json` routes (`/projects/([^/]+)` → `/apps/web/project?...`) — route group ไม่กระทบเพราะ Vercel map ตาม URL path ไม่ใช่ folder
- PIN hash ใช้ `DRIVER_ACCESS_TOKEN_SECRET` (มีใน env แล้ว)
- driver page เป็น public (middleware allow) — PIN gate เป็น cookie ธรรมดา ไม่ใช่ auth session
