# Phase I — Driver page: production UX

User feedback (2026-09-08, round 4):
1. แผนที่ฝั่งคนขับกระพริบ + ซ่อนไม่ได้
2. ข้อความ "ระบบทดสอบ" เยอะ — ทำให้เป็นหน้าตาใช้งานจริง
3. ศูนย์ไม่เห็นสถานะที่คนขับกด (ถึงจุดรับ / รับผู้โดยสารแล้ว)
4. ฝั่งคนขับควรเป็นกล่องแชท เห็นบทสนทนาทั้งสองทาง
5. รายละเอียดคนขับ/รถ/ทะเบียน ควรอยู่บนสุด + ซ่อนได้ (ไม่ใช่ "รายละเอียดเพิ่มเติม" ล่างสุด)
6. งานปัจจุบัน + แถบงานถัดไปที่ซ่อน/แสดงได้ เสร็จแล้วงานต่อไปขึ้นมา
7. สแกน QR แล้วไม่ต้องกดรหัส
8. บังคับถ่าย/อัปรูปรถ+ป้ายทะเบียน และต้องเป็นหลักฐานในศูนย์
9. UX/UI อื่น ๆ ให้คนขับใช้ง่าย

## Root causes
- **#1** `<DriverLocationShare>` renders `<iframe src={buildOsmEmbedUrl(lastLocation)}>` — the bbox changes on every GPS ping (`watchPosition`, `maximumAge:5000`) → the iframe reloads constantly.
- **#2** hard-coded copy: "ข้อจำกัดของ web app / ระหว่างทดสอบ…", "ต้องใช้ Mobile App ในระยะถัดไป", "ถ่ายรูป… (ระยะถัดไป)", "รายละเอียดเพิ่มเติม (ไม่บังคับ)", "เวอร์ชันงาน".
- **#3** flow is wired (`assignmentStatusUpdateAction` → `assignment_status_updates` → `getLatestAssignmentStatuses` → new `<FleetBoard>`); `arrived_pickup`/`passenger_onboard` are in `formatStatusTh`. Phase H's FleetBoard now surfaces it — verify on the new deploy. Add the same status line to `<CommsConsole>` feed and a status-history list.
- **#4** driver only sees `notifications` (centre→driver, max 3). No thread, no view of own sent messages.
- **#5** driver/vehicle/plate is in the bottom `notesOpen` collapsible.
- **#6** all `TRIP_STEPS` render at once.
- **#7** every generated token gets `pinHash` (→ `pinRequired`); prod has ~no legacy tokens. Most likely: stale `dpin_<tokenId>` cookie (12 h) or an old test token. Verify + tighten.
- **#8** photo infra EXISTS but unused by `<DriverTaskView>`: `vehiclePhotoUploadAction`, `vehicleCheckinAction` (`photo_url`, `plate_photo_url`), buckets `driver-evidence` + `driver-checkin-photos` live on cloud. Centre never shows the photos.

## Tasks

### I1 — map: kill flicker + collapsible
`<DriverLocationShare>`: replace the `<iframe>` with `<LiveTrackingMap points={[myPoint]} height={240}>` (updates markers in place, fits bounds once). Local "ซ่อน/แสดงแผนที่" toggle (default shown). Drop `buildOsmEmbedUrl` + the `mapUrl` useMemo.

### I2 — production copy
- `<DriverLocationShare>`: delete the blue "ข้อจำกัดของ web app" block; one calm line: "เปิดหน้านี้ค้างไว้ระหว่างเดินทาง หรือเปิดในแอปเพื่อแชร์ต่อเนื่องแม้ปิดจอ" + keep the `tompdriver://` deep link here.
- `<DriverTaskView>`: remove "(ระยะถัดไป)" note, "เวอร์ชันงาน", the whole bottom `notesOpen` block (moved up by I3).
- `app/driver/page.tsx`: not-found → calm card, drop the 4xl 🚫.

### I3 — identity card at top, collapsible
`<DriverTaskView>` — right after `<header>`, a collapsible card (default open, chevron): "คนขับ <ชื่อ> · <เบอร์>" / "รถ <ทะเบียน> · <ประเภท> · <n> ที่นั่ง". Remove the bottom copy.

### I4 — chat thread
- `lib/data/driver-access.ts` → add `messages: DriverThreadMessage[]` (`{ id, from: "driver"|"centre", text, at, kind }`) built from `driver_issue_reports` (this assignment) + fold in `notifications`. New type exported.
- `/api/driver/updates` → return `messages` too.
- New `components/driver/driver-chat-thread.tsx` — bubble list (driver right teal, centre left grey), newest at bottom, auto-scroll, composer with the existing `QUICK_MESSAGES` chips, sends via `driverIssueReportAction` (kind `driver_message`). Replaces the "ข้อความจากศูนย์" section + the `messageOpen` sheet. The 3-button row keeps "โทรศูนย์" + "แจ้งปัญหา"; "ข้อความ" scrolls to the thread.
- `<DriverTaskView>` poll merges `messages` into thread state; new centre message → banner.

### I5 — current step + collapsible next
"sharing" phase: current `TRIP_STEPS[tripStep]` = the big button; completed = green check chips row; remaining (after current) inside a "ขั้นตอนถัดไป (N)" collapsible. All done → "งานนี้เสร็จแล้ว ขอบคุณครับ" panel.

### I6 — mandatory vehicle photos + centre evidence
- `<DriverTaskView>` checklist (assigned phase): 2 capture inputs (`accept="image/*" capture="environment"`) — รูปรถ, รูปป้ายทะเบียน. On pick → upload via a new `driverEvidenceUploadAction(formData)` (wraps `uploadVehiclePhoto`/`uploadPlatePhoto`, token-auth — resolve project/assignment from the token, not trusted form fields). Store returned `path` in state; show a ✓ + thumbnail (object URL).
- **HARD gate**: "พร้อมรับงาน" disabled until both photos uploaded. Checklist ticks stay soft.
- `markReady` also calls `vehicleCheckinAction({ ...ids, vehicleId, status: "ready", photoUrl, platePhotoUrl })`.
- Centre: `lib/data/vehicle-checkins.ts` → `getLatestVehicleCheckinsByProjectId(projectId)` (latest per assignment, `photo_url`/`plate_photo_url`), + sign the paths (`storage.from("driver-evidence").createSignedUrl`, 1 h). Add `evidence` to `/api/mission-control/comms` response. `<FleetBoard>` expanded row → "หลักฐานตรวจรถ" 2 thumbnails linking to the signed URL.

### I7 — PIN
`app/actions/driver-access.ts`: on the "resend" nothing to do. `app/driver/page.tsx`: no change to logic. `<DriverAccessGenerator>`: make the PIN block the first thing shown, bigger, "คนขับต้องกรอกรหัสนี้หลังสแกน QR". `driver-pin.ts` `setPinCookie` maxAge 12 h → keep. Add note in handoff: to re-test the gate, use a fresh QR or clear the `dpin_*` cookie.

### I8 — polish
- header: keep GPS light; add a persistent "โทรศูนย์" affordance when a coordinator phone exists.
- calmer palette, min tap target 44px (mostly already), remove emoji-heavy states.

### I9 — verify + ship
typecheck · lint · test · build · commit · push · `smoke:production` · handoff `942` · memory.

## Out of scope
- Multi-assignment "today's jobs" list (1 QR = 1 assignment; #6 handled as trip steps).
- Replacing legacy `vercel.json`.
- EAS build of `apps/mobile-driver`.
