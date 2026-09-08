# Driver status → every centre view + live vehicle map

User: driver step status still not visible in the centre / vehicle-management page;
the map on `/resources/vehicles` is "a static object that doesn't move".

## Root cause — driver status

The driver's trip steps (`arrived_pickup` / `passenger_onboard` / `completed`) were
written **only** to `assignment_status_updates`. `assignments.status` stayed
`planned` forever, so every view that reads `assignment.status` (task cards,
dispatch board, project overview, vehicle queue) showed a stale plan status —
"nothing happened". Only `<FleetBoard>` on `/mission-control` read the updates
table, and even there a transient empty poll could wipe it.

### Fixes
- `assignmentStatusUpdateAction`: after inserting the update, also
  `update assignments set status = 'active' | 'completed'` (only from
  draft/planned/published/active) — the assignment now reflects the driver's
  progress everywhere.
- `driverCheckinAction` (`status: "ready"`): assignment → `active` (driver passed
  pre-flight, the job is live).
- `lib/data/vehicle-operations.ts`: `VehicleOperationTask.reportedStatus` — the
  latest `assignment_status_updates` row per assignment (merged across projects).
- `<VehicleTaskCard>`: shows "● <step> · แจ้งโดยคนขับ <relative>" when present.
- `<FleetBoard>`: poll now **merges** statuses/evidence instead of replacing, so a
  one-off empty response can't clear a known status.

## Vehicle fleet map

`<VehicleFleetMap>` was the old OSM `<iframe>` + CSS-projected overlay markers,
rendered once server-side with no polling → static and mis-placed.
Rewritten as a client component using `<LiveTrackingMap>` (Leaflet): real markers
+ trails + popups, polls `/api/mission-control/locations` every 10 s, colour by
freshness. Matches the mission-control map.

## "งานที่เพิ่มไปให้คนขับ ไม่ขึ้น"

New assignments were inserted with no `status` → the DB default `'draft'`, which
some views treat as a hidden/not-yet-real job. `createAssignmentAction` now sets
`status: "planned"` — a freshly dispatched job is immediately visible as real work.
(A QR still has to be generated for the new assignment; a QR made for a later
cancelled assignment stays pointed at the cancelled one.)

## "ภาพถ่ายไม่ขึ้นที่ศูนย์"

The upload + storage + signed URLs were all fine (verified: files exist, 100 KB+
JPEGs, `createSignedUrls` works). The photos only rendered inside the **expanded**
`<FleetBoard>` card, nowhere else.
- `VehicleOperationTask.evidence` — the latest `vehicle_checkins` photos (signed)
  per assignment; shown on every `<VehicleTaskCard>` (the `/resources/vehicles`
  queue) as thumbnails.
- `<FleetBoard>` collapsed card now shows a "📷 มีรูปตรวจรถ" chip so the centre
  knows without expanding.

## "หน้าตาการให้สิทธิ์ ดูยาก"

`<InviteUserForm>` project-role picker: cramped single `<select>` with
`label — long hint` options → radio cards (label + hint on their own lines),
matching the "ประเภทผู้ใช้" pattern already in the form.

## Also

- Driver chat composer (`<DriverChatThread>`) auto-grows with the text up to
  ~6 lines, like a mobile chat app.

## Verify
typecheck 0 · lint 0 · web 54 / driver-core 14 · build.
