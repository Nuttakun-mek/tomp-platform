# Phase J — driver entry gate + photo upload fix

User feedback (2026-09-08, round 5):
- รายละเอียดรถของตัวเองเบื้องต้น
- หน้าเข้าฝั่งคนขับควรมีการกรอกรหัสจากการสแกน QR
- การตรวจเช็ครายละเอียดควรอยู่ก่อนเข้าสู่ระบบ (ก่อนเห็นงาน)
- ส่วนอื่น ๆ ควรมีหลังเข้าระบบแล้ว
- ระบบอัปรูปไม่ได้

## Root cause — upload
`getSupabaseWriteClient()` wraps fetch in a **4 s timeout** (`createTimeoutFetch(4000)`).
A 2–5 MB phone photo over mobile data never finishes in 4 s → the upload aborts →
"อัปโหลดรูปไม่สำเร็จ". Also Next server actions cap the body at 1 MB by default.

## Fixes

### J1 — photo upload
- `<DriverPhotoCheck>`: **compress client-side** — `createImageBitmap` → canvas resize
  to 1600 px max edge → `toBlob("image/jpeg", 0.75)` (~200–400 KB). Upload via
  `fetch("/api/driver/evidence")` (route handler, no server-action body cap).
- `app/api/driver/evidence/route.ts` — token-authed (project/assignment from the token),
  `maxDuration = 30`.
- `lib/storage/photo-upload.ts` — dedicated Supabase client **without** the 4 s fetch
  timeout; sends `Uint8Array` (not the `File`), `upsert: true`.
- `next.config.ts` — `experimental.serverActions.bodySizeLimit = "6mb"` (headroom).

### J2 — `activated` flag
`getDriverAssignmentByToken` → `activated: boolean` = a `driver_checkins` row with
`status = 'ready'` exists for the assignment (both supabase + pg paths, service client).

### J3 — `<DriverPreflight>` gate
New screen shown after the PIN, before `<DriverTaskView>`, while `!activated`:
- "รถของคุณ" card — plate / type / capacity + driver name + phone
- required photos (`<DriverPhotoCheck>`)
- confirm checkboxes: ชื่อ / เบอร์ / รถ / ยินยอม GPS
- "ยืนยันและเริ่มงาน" — enabled only when all done → `driverCheckinAction({status:"ready"})`
  + `recordVehicleEvidenceAction` → reload → now `activated` → `<DriverTaskView>`

### J4 — `app/driver/page.tsx` flow
`no token → error` · `pinRequired && !cookie → <DriverPinGate>` ·
`!activated → <DriverPreflight>` · else `<DriverTaskView>`.

### J5 — `<DriverTaskView>` = post-entry only
Removed the "assigned" phase, `<DriverPhotoCheck>`, the 4-check checklist, `markReady`.
Phases are now `"ready" | "sharing"` starting at `"ready"`. Keeps: identity card
(top, collapsible), route, "เริ่มแชร์ GPS", trip steps (current + collapsible next),
chat thread, issue reporting, comms row.

## Verify
typecheck 0 · lint 0 · web 54/15 · driver-core 14/5 · build `JBUILD=?` · `smoke:production`.

## PIN note
Every generated token stores `pinHash` → `<DriverPinGate>` shows after scan unless the
`dpin_<tokenId>` cookie (12 h, path `/driver`) is already set from a prior verification
on that browser. To re-test the gate: fresh QR or clear that cookie / use a private tab.
