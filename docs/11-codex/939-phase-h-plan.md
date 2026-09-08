# Phase H — Mission Control clarity + two-way comms + vehicle route fix

From user feedback (2026-09-08, round 3):
1. กดดูรายละเอียดรถ → 404 (Vercel edge `NOT_FOUND`)
2. หน้าแผนที่ควรปิดซ่อน/แสดงได้
3. ส่งข้อความหากันไม่เห็น · "คำที่มีให้กด" (quick phrases) หายไป
4. ฝั่งศูนย์เปิดดูข้อความไม่ได้
5. UI/UX ฝั่งศูนย์สับสน — ยิ่งมีรถหลายคันยิ่งงง

## Root causes found

| # | cause |
|---|---|
| 1 | Legacy `vercel.json` `builds`+`routes`: every dynamic route needs an explicit `routes` rewrite (like `/projects/([^/]+)`, `/driver/([^/]+)`). `/resources/vehicles/([^/]+)` has none → falls to catch-all `dest:/apps/web/$1` which can't hit `@vercel/next`'s dynamic matcher → edge 404. Also `getVehicleOperationProfileById` → `notFound()` when null. |
| 2 | Map (`<LiveLocationMap>`) always rendered, no collapse. |
| 3 | Driver `sendMessage` → `driver_issue_reports` (kind `driver_message`). **Nothing in MC reads `driver_issue_reports`** (only the realtime channel triggers a refresh). `<DriverTaskView>` message sheet is a bare textarea — no quick-phrase chips. Safety issue sends `severity:"critical"` but the DB check is `in ('info','warning','urgent')` → insert fails. |
| 4 | `<DriverNotificationConsole/>` in `mission-control/page.tsx` gets **no props** (`notifications=[]`). Center→driver form (`<VehicleMessageForm>`) is buried in the vehicle rail and only renders when the assignment has a `currentTask` (mission). |
| 5 | MC page renders 11 panels, 4 of them (`DriverOperationsPanel`, `AssignmentMonitor`, `VehicleMonitorPanel`, `DriverSignalPanel`) show driver/vehicle status in different shapes. No single scannable per-call-sign view. |

## Tasks

### H0 — migration `0022_driver_issue_severity_critical.sql`
`alter table public.driver_issue_reports drop constraint driver_issue_reports_severity_check;`
`add constraint ... check (severity in ('info','warning','urgent','critical'));`
Apply local + cloud, mirror to `supabase/migrations/`.

### H1 — vehicle detail route
- New `apps/web/app/(app)/resources/vehicle/page.tsx` — reads `searchParams.vehicleId`; renders shared `<VehicleProfileDetail vehicleId>`; when profile is null shows an empty-state ("ไม่พบข้อมูลรถ หรือยังไม่มีสิทธิ์เข้าถึง" + back link), **never `notFound()`**.
- Extract the current `[vehicleId]/page.tsx` body into `apps/web/components/resources/vehicle-profile-detail.tsx` (server component, prop `vehicleId`).
- `[vehicleId]/page.tsx` → `redirect('/resources/vehicle?vehicleId=' + token)` shim (local-dev parity; shadowed on prod).
- `vercel.json`: add before the catch-alls
  `{ "src": "/resources/vehicles/([^/]+)", "dest": "/apps/web/resources/vehicle?vehicleId=$1" }`
- Links stay `/resources/vehicles/<id>` (clean URL; rewrite on prod, redirect on dev).

### H2 — `<CollapsibleSection>`
`apps/web/components/ui/collapsible-section.tsx` — `"use client"`, props `{ title, defaultOpen=true, storageKey?, badge?, children }`. Header button toggles; state persisted to `localStorage` under `storageKey` (try/catch, render correctly with no stored value).

### H3 — map collapsible
`mission-control/page.tsx`: wrap `<LiveMapPanel>` in `<CollapsibleSection title="แผนที่ติดตามตำแหน่ง" storageKey="mc.map">`.

### H4 — comms data
`apps/web/lib/data/driver-comms.ts`:
- `getDriverCommsByProjectId(projectId): Promise<{ inbound: DriverInboundMessage[]; outbound: DriverOutboundMessage[] }>`
- inbound ← `driver_issue_reports` (order `created_at desc` limit 60) → `{ id, assignmentId, driverId, issueType, severity, message, status, at, kind }` (`kind = metadata.kind ?? 'issue'`)
- outbound ← `driver_notifications` (limit 60) → `{ id, assignmentId, driverId, title, body, priority, status, at }`
- `resolveReadClient()` then postgres fallback, same shape as `assignment-status.ts`.

### H5 — comms API
`apps/web/app/api/mission-control/comms/route.ts` — GET `?projectId=` → `{ success, checkedAt, data: { inbound, outbound } }`, `withTimeout` 9s, mirror the locations route.

### H6 — `<CommsConsole>`
`apps/web/components/mission-control/comms-console.tsx` (`"use client"`):
- props `{ projectId, assignments, callSigns, initialInbound, initialOutbound }`
- merged feed sorted by time — inbound cards (คนขับ → ศูนย์, slate/amber by severity) + outbound cards (ศูนย์ → คนขับ, blue); call-sign filter chips.
- composer: call-sign select (from assignments w/ callSign) + textarea + **quick-phrase chips** ("ยืนยันถึงจุดรับหรือยัง", "อัปเดตตำแหน่งด้วย", "เปลี่ยนจุดส่ง โปรดโทรกลับ", "รอลูกค้าที่จุดเดิม") → `sendDriverNotificationAction`.
- poll `/api/mission-control/comms` every 15s.
- Wire into `page.tsx`; delete `<DriverNotificationConsole/>` + `<RouteChangeConsole/>` from render (keep files).

### H7 — `<FleetBoard>`
`apps/web/components/mission-control/fleet-board.tsx` (`"use client"`) — the primary MC surface:
- props `{ projectId, assignments, callSigns, drivers, vehicles, initialLocations, initialStatuses }`
- one row per assignment: Call Sign · คนขับ/ทะเบียน · **สถานะที่คนขับแจ้ง** (+ อายุ) · สถานะแผน · จุด GPS (สด/ช้า/ขาด, dot) · ปุ่มขยาย
- expanded: เบอร์โทร (`tel:`), พิกัด + ลิงก์ Google Maps, ประวัติสถานะ, ปุ่ม "ส่งข้อความ" (opens composer prefilled with that call sign — reuse `sendDriverNotificationAction`).
- polls `/api/mission-control/locations` + a new lightweight `/api/mission-control/statuses?projectId=` every 10s (or fold statuses into the comms route). Keep it simple: reuse locations route + add statuses to the comms route response.
- sort: needs-attention first (no GPS / stale / blocked), then by call sign.

### H8 — `mission-control/page.tsx` restructure
Render order:
1. `<CommandCenterHeader>` + `<ProjectSwitcher>` + `<OperationKpiStrip>`
2. `<FleetBoard>` (primary, full width)
3. `<CollapsibleSection "แผนที่ติดตามตำแหน่ง" storageKey=mc.map>` → `<LiveMapPanel>`
4. `<CommsConsole>`
5. `<CollapsibleSection "ไทม์ไลน์ปฏิบัติการ" defaultOpen=false storageKey=mc.timeline>` → `<OperationTimelinePanel>`
6. `<CollapsibleSection "งานที่ยังขาดข้อมูล" defaultOpen=false storageKey=mc.risk>` → `<RiskAndExceptionPanel>`
7. `<CollapsibleSection "รายละเอียดรถ" defaultOpen=false storageKey=mc.vehicles>` → `<VehicleMonitorPanel>`
Drop from render (keep files): `DriverOperationsPanel`, `AssignmentMonitor`, `DriverSignalPanel`, `DecisionPanel`, `RealtimeStatusPanel`, `DriverNotificationConsole`, `RouteChangeConsole`. Remove now-unused imports/fetches.

### H9 — driver quick phrases + severity
`driver-task-view.tsx`: message sheet — chips row above the textarea (tap fills `messageText`, editable): "ถึงจุดรับแล้ว", "กำลังไปจุดส่ง", "รถติด คาดว่าช้า ~15 นาที", "ติดต่อผู้โดยสารไม่ได้", "ถึงจุดส่งแล้ว". `reportIssue` safety severity stays `"critical"` (valid after H0).

### H10 — verify + ship
typecheck · lint · test · build · commit · push (auto-deploy) · `smoke:production` · handoff `940` · update memory.

## Out of scope (backlog)
- Replace the whole legacy `vercel.json` `builds`+`routes` with modern config + dashboard Root Directory (needs the user in the Vercel dashboard; risky unattended).
- Supabase realtime for comms (15s poll is fine).
- "งานวันนี้" list on driver page.
