# Phase G — done (Driver ↔ Mission Control operational data flow)

Deployed 2026-09-08. Plan: `937-phase-g-plan.md`.

## Round 1 — commit `19e2d26`
- Login page no longer barren — brand + "ระบบบริหารจัดการการเดินทางและบริการ" +
  "Transportation Operations Management Platform" + 3 value bullets beside the
  sign-in card (`components/auth/login-panel.tsx`).
- `/superadmin/users` invite form → radio "เจ้าหน้าที่โครงการ" / "ผู้ดูแลแพลตฟอร์ม"
  with per-role hints, org dropdown removed (`invite-user-form.tsx`).
- G4: `getVehicleOperationProfileById` falls back to a bare profile (0 jobs)
  instead of returning null → no more `/resources/vehicles/[id]` 404.
- G3 (partial): `lib/data/locations.ts` drops `placeholder` / `demo` / `0,0`
  GPS rows — they were rendering as a stuck marker.
- G2 (partial): `GET /api/driver/updates?token=` + 15 s poll in `<DriverTaskView>`
  → control-centre messages arrive without a refresh; "ข้อความ" button sends
  driver → control (`driverIssueReportAction`, issueType `message`); GPS status
  light; 3-button instant-comms row (โทรศูนย์ / ข้อความ / แจ้งปัญหา).

## Round 2 — commit `e8e994e`
- **Real interactive map.** `components/mission-control/live-tracking-map.tsx` —
  plain Leaflet (`leaflet` dep, dynamic import, `leaflet/dist/leaflet.css`).
  `<LiveTrackingMap points={TrackedPoint[]} height={480}>`: one `L.circleMarker`
  per driver coloured by freshness (`live` green / `slow` amber / `offline` grey
  / `stopped` slate), `L.polyline` trail keeping the last 30 fixes per driver,
  bound popups, one-time `fitBounds`. Exports `toTrackedPoint(location,
  freshness, title, subtitle, ageLabel)`. `live-location-map.tsx` replaced its
  OpenStreetMap `<iframe>` + absolutely-positioned overlay markers (which never
  aligned to real coordinates — the "object ค้าง" the user reported) with this.
- **G1 — driver status → MC.** `lib/data/assignment-status.ts` →
  `getLatestAssignmentStatuses(projectId)` reads `assignment_status_updates`
  (`created_at desc` limit 200, dedup by `assignment_id`). `mission-control/page.tsx`
  fetches it + `getCallSignsByProjectId` and passes both to `<AssignmentMonitor>`.
  The monitor (rewritten) shows the Call Sign instead of a raw UUID, the planned
  status, and — when a driver has reported — `● <status> · แจ้งโดยคนขับ <relative>`.
- **G5 — pre-job checklist.** `<DriverTaskView>` "assigned" phase: a collapsible
  `(N/4)` checklist (name / phone / vehicle / GPS). Soft gate — "พร้อมรับงาน"
  still works unchecked but reads "พร้อมรับงาน (ยังตรวจไม่ครบ)"; ticked values
  are passed as `confirmedName` etc. to `markReady`.
- **G7 — native app.** `apps/mobile-driver` (Expo) was already fully built:
  background `startLocationUpdatesAsync` + Android foreground-service
  notification + offline queue + QR scan + `tompdriver://?token=` deep link.
  README rewritten with `eas build` steps. `<DriverTaskView>` "sharing" phase
  now shows an "เปิดในแอป TOMP Driver — แชร์ GPS ต่อเนื่องแม้ปิดจอ" deep link.

## Verify
- typecheck 0 · lint 0 · web tests 54/15 files · driver-core 14/5 files · build `G2BUILD=0`.
- `npm run smoke:production` after deploy.

## Deferred
- "งานวันนี้" list on the driver page — one QR is one job for today, low value.
- Supabase realtime channel — the 15 s poll is enough for now.
- `eas build` of `apps/mobile-driver` — needs an Expo account / EAS run (user).
- Org CRUD + occasional-use admin URL (backlog since Phase F).
