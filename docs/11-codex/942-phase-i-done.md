# Phase I — done (driver page: production UX)

Deployed 2026-09-08. Plan: `941-phase-i-plan.md`.

## I1 — map flicker + collapsible
`<DriverLocationShare>` rendered `<iframe src={osmEmbedUrl(lastLocation)}>` — the bbox
changed on every GPS ping so the iframe reloaded constantly. Replaced with
`<LiveTrackingMap points={[myPoint]} height={220}>` (Leaflet — updates the marker in
place, fits bounds once) + a "ตำแหน่งของฉันบนแผนที่" show/hide toggle.

## I2 — production copy
- `<DriverLocationShare>`: deleted the "ข้อจำกัดของ web app / ระหว่างทดสอบ…" block; one
  calm status line; the panel is now a compact card, not a big blue billboard.
- `<DriverTaskView>`: removed "(ระยะถัดไป)", "เวอร์ชันงาน", the bottom
  "รายละเอียดเพิ่มเติม (ไม่บังคับ)" section.
- `/driver` not-found: calm card, no 4xl 🚫.

## I3 — identity at the top, collapsible
คนขับ · เบอร์ · รถ · ทะเบียน · ที่นั่ง now sits directly under the Call Sign header in
a collapsible card (default open). Removed from the bottom.

## I4 — chat thread (2-way, with history)
- `getDriverIssueMessagesByAssignmentId` + `DriverAccessAssignment.messages`
  (`driver_issue_reports` for this assignment). `/api/driver/updates` returns `messages`.
- `<DriverChatThread>` — bubble list (driver right teal, centre left grey), newest at
  bottom, auto-scroll, quick-phrase chips, Enter-to-send. Always visible. Replaces the
  old "ข้อความจากศูนย์" list + the hidden message sheet. Driver messages are optimistic.
- The "แชท" button in the 3-button row scrolls to `#driver-chat`.

## I5 — current step + collapsible next
"sharing" phase: completed steps = green chips; the current step is one big button;
remaining steps fold under "ขั้นตอนถัดไป (N)". All done → "งานนี้เสร็จแล้ว ขอบคุณครับ".

## I6 — mandatory vehicle photos + centre evidence
- `<DriverPhotoCheck>` — 2 capture inputs (รูปรถ / รูปป้ายทะเบียน,
  `accept="image/*" capture="environment"`). Uploads immediately via
  `driverEvidenceUploadAction` (token-authed — project/assignment from the token, not the
  form) to the private `driver-evidence` bucket.
- **Hard gate**: "พร้อมรับงาน" is disabled until both photos are uploaded.
- `markReady` → `recordVehicleEvidenceAction` writes a `vehicle_checkins` row with the
  two storage paths + a timeline event.
- Centre: `lib/data/vehicle-evidence.ts` `getVehicleEvidenceByProjectId` (latest per
  assignment, `createSignedUrls` 1 h). Added to `/api/mission-control/comms` as
  `evidence`. `<FleetBoard>` expanded row shows the two thumbnails (or
  "ยังไม่มีรูปตรวจรถจากคนขับ").

## I7 — PIN
Every generated token already stores `pinHash` → `<DriverPinGate>` shows after scan.
"No prompt" is a stale `dpin_<tokenId>` cookie (12 h) or a pre-Phase-D token. Made the
PIN block in `<DriverAccessGenerator>` bigger and explicit ("คนขับต้องกรอกหลังสแกน QR").
To re-test the gate: generate a fresh QR or clear the `dpin_*` cookie.

## I8 — polish
Calmer palette, fewer emojis, min 44px targets, "โทรศูนย์" in the persistent 3-button row.

## Verify
typecheck 0 · lint 0 · web 54/15 · driver-core 14/5 · build `IBUILD=?` · `smoke:production`.

## Deferred
- Multi-assignment "today's jobs" (1 QR = 1 job; handled as trip steps).
- Replacing legacy `vercel.json`.
- EAS build of `apps/mobile-driver`.
