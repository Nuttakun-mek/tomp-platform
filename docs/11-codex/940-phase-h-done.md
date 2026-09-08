# Phase H — done (MC clarity + two-way comms + vehicle route)

Deployed 2026-09-08. Plan: `939-phase-h-plan.md`.

## H0 — migration `0022_driver_issue_severity_critical.sql`
Widened `driver_issue_reports_severity_check` to `('info','warning','urgent','critical')`.
`<DriverTaskView>` safety reports send `severity:"critical"` (schema allowed it, the
check constraint did not — every safety report was failing to insert). Applied cloud +
local, mirrored to `supabase/migrations/`.

## H1 — vehicle detail 404
Legacy `vercel.json` `builds`+`routes` needs an explicit rewrite for every nested
dynamic route (`/projects/([^/]+)`, `/driver/([^/]+)` have them; `/resources/vehicles/[id]`
never did → Vercel edge `NOT_FOUND`).
- `vercel.json`: `{ "src": "/resources/vehicles/([^/]+)", "dest": "/apps/web/resources/vehicle?vehicleId=$1" }`
- New `app/(app)/resources/vehicle/page.tsx` reads `searchParams.vehicleId`.
- `components/resources/vehicle-profile-detail.tsx` — shared body; **empty-state instead
  of `notFound()`** when the profile is null.
- `[vehicleId]/page.tsx` → redirect shim to `/resources/vehicle?vehicleId=` (dev parity).

## H2 — `<CollapsibleSection>`
`components/ui/collapsible-section.tsx` — show/hide wrapper, open state remembered per
viewer in `localStorage` (`collapsible:<storageKey>`).

## H3 — map show/hide
`<LiveMapPanel>` now sits inside `<CollapsibleSection storageKey="mc.map">`. Collapsed →
the map unmounts and its 7 s location poll stops.

## H4/H5/H6 — two-way comms that is actually visible
- `lib/data/driver-comms.ts` → `getDriverCommsByProjectId(projectId)`: inbound from
  `driver_issue_reports` (messages + issues), outbound from `driver_notifications`.
  Scoped read client (`is_project_member` RLS covers both tables) + postgres fallback.
- `app/api/mission-control/comms/route.ts` → GET `?projectId=` returns
  `{ inbound, outbound, statuses }` (statuses = latest driver-reported per assignment).
- `components/mission-control/comms-console.tsx` — merged time-sorted feed (คนขับ→ศูนย์ /
  ศูนย์→คนขับ), call-sign filter chips, composer with call-sign picker + **quick-phrase
  chips**, 15 s poll. Replaces the prop-less `<DriverNotificationConsole/>` (which always
  showed "no notifications") and `<RouteChangeConsole/>` in the MC render.

## H7/H8 — Mission Control is one scannable board now
- `components/mission-control/fleet-board.tsx` — **one row per Call Sign**: freshness dot,
  driver/plate, driver-reported status + age, plan status, GPS label; expand for phone
  (`tel:`), coordinates + Maps link, accuracy. Sorted needs-attention-first
  (no GPS → offline → slow → live). Polls locations (10 s) + statuses.
- `mission-control/page.tsx` rebuilt as a vertical stack: header · project switcher · KPI
  strip · **FleetBoard** · collapsible map · CommsConsole · collapsible
  (vehicles / risks / timeline).
- Dropped from render (files kept): `DriverOperationsPanel`, `AssignmentMonitor`,
  `DriverSignalPanel`, `DecisionPanel`, `RealtimeStatusPanel`, `DriverNotificationConsole`,
  `RouteChangeConsole`. Was 11 panels, 4 of them redundant status views.

## H9 — driver quick phrases
`<DriverTaskView>` message sheet: 5 quick-phrase chips above the textarea (tap fills the
box, still editable).

## Verify
typecheck 0 · lint 0 · web 54/15 · driver-core 14/5 · build `HBUILD=?` · `smoke:production`.

## Still deferred
- Replace the whole legacy `vercel.json` `builds`+`routes` with modern config + Vercel
  dashboard Root Directory (needs the user in the dashboard).
- Supabase realtime for comms (15 s poll is fine).
- "งานวันนี้" list on the driver page.
- EAS build of `apps/mobile-driver`.
