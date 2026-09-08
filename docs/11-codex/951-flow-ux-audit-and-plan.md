# Flow + UX audit and improvement plan

Audit of the real end-to-end flows (operator and driver), menu structure, and a
benchmark against mainstream dispatch/fleet platforms (Onfleet, Bringg, Samsara,
Motive, Tookan, Verizon Connect).

---

## 1. Operator flow — what actually happens today

To get one driver working, a dispatcher must visit **5 different pages** in 3
different contexts:

| # | Step | Where | Leaves project context? |
|---|---|---|---|
| 1 | สร้างโครงการ | `/projects` | – |
| 2 | สร้างภารกิจ | `/project?projectId=` (tab ภาพรวม) | no |
| 3 | สร้างคนขับ | `/resources/drivers` | **yes** |
| 4 | สร้างรถ | `/resources/vehicles` | **yes** |
| 5 | **สร้าง Call Sign** | **ไม่มีหน้าให้สร้าง** | — |
| 6 | สร้างงาน (assignment) | `/assignments?projectId=` | no |
| 7 | สร้าง QR + PIN | same page | no |

### 🔴 BLOCKER — Call Sign cannot be created
`createAssignmentAction` requires `callSignId`, and `<CreateAssignmentForm>` is
disabled unless `callSigns.length > 0`. But there is **no `createCallSignAction`
and no form anywhere** — `call_signs` rows only exist because the pilot
smoke-test seeder inserts them (`actions/pilot-smoke-test.ts:239`).

**A real user starting from an empty system cannot create a job at all.**

### Other flow problems
- **Concept overhead.** "Call Sign" is a separate entity the user must pre-create
  and understand. No comparable product does this — the unit label is either the
  vehicle plate or an auto-generated job number.
- **Resources live outside the project.** Drivers and vehicles are a global pool
  (`/resources/*`) but jobs are per-project. Mid-flow the dispatcher is thrown out
  of the project and has to navigate back.
- **Menu duplication.** After the Phase H/K rework, `/mission-control` (FleetBoard)
  and `/resources/vehicles` (VehicleOperationsBoard) now show the *same* thing —
  vehicle, driver, status, GPS, photos. Two pages, one job.
- **Orphaned pages.** `/recovery` is not in any menu; `/resources` is a hub page
  that only holds two links; `/superadmin/organizations` redirects; `/portal` reads
  `projects[0]` so it breaks with more than one project.
- **No inline creation.** Every "you're missing X" dead-end requires leaving the
  form, creating X elsewhere, and coming back — losing the form state.

---

## 2. Driver flow — what actually happens today

`Scan QR → PIN → Preflight → Ready → Sharing`

### 🔴 Two "เริ่มแชร์ตำแหน่ง GPS" buttons
`<DriverTaskView>` phase `ready` shows a big **"เริ่มแชร์ตำแหน่ง GPS"** button that
only flips a local UI phase (`setPhase("sharing")`). It does **not** touch GPS.
The next screen shows `<DriverLocationShare>` with its own **"เริ่มแชร์ตำแหน่ง"**
button — the one that actually calls `watchPosition`. The driver presses "start
GPS" twice, and if they miss the second one, the centre never sees them.

### 🔴 The GPS status light lies
`setGpsLight("live")` fires on that first fake button — before any permission
prompt or fix — and is **never** set back to `stale`/`off` on denial, error, or
staleness. The header can read "GPS สด" while nothing is being shared. In an ops
tool a status indicator that can be wrong is worse than none.

### Missing for a driver
- No list of the driver's other jobs today → they can't see what's next, and one
  QR only ever opens one job.
- No break / unavailable state.
- No proof of delivery (photo/signature at drop-off) — photos exist only at
  pre-flight.
- No push notification — the app polls every 15 s while the page is open; a
  backgrounded phone gets nothing.
- Status is fully manual — no arrival auto-detection.

---

## 3. Benchmark vs mainstream platforms

| Capability | Industry standard | TOMP today |
|---|---|---|
| Job creation | one dispatch screen, inline resource create, bulk CSV import | 5 pages, no CSV, **call sign blocker** |
| Job identity | auto job number / plate | manual pre-created Call Sign |
| Assign | drag-drop on a board/map | dropdown form |
| ETA / route | auto ETA, sequencing, optimisation | none |
| Arrival status | geofence auto-detect | driver taps a button |
| Proof of delivery | photo + signature + notes, geotagged | pre-flight photos only |
| Driver notify | push (FCM/APNs) + SMS | in-app polling only |
| Customer view | public tracking link | none |
| Exceptions | late / idle / off-route alerts w/ thresholds | "ยังไม่มี GPS" only |
| Recurring work | templates, schedules | none |
| Offline | queue + retry | mobile app only (unbuilt) |
| Audit | full timeline | ✅ have |
| Evidence store | private + signed URLs | ✅ have |
| RBAC | per-project roles | ✅ have |

**Read:** the data model and audit/RBAC foundations are solid and comparable. The
gaps are in *workflow ergonomics* (creation flow, one screen, inline actions) and
*automation* (ETA, geofence, push).

---

## 4. Plan

### Phase Q — unblock + collapse the operator flow  *(highest priority)*
1. **Call Sign**: `createCallSignAction` + inline "＋ สร้าง Call Sign" in the
   assignment form. Better: **auto-generate** (`{PROJECT_CODE}-01`, `-02`, …) when
   the dispatcher doesn't care, with an option to rename. Removes the concept from
   the critical path.
2. **One "สร้างงาน" screen.** The assignment form gets inline create for every
   missing dependency (mission / driver / vehicle / call sign) as a modal — never
   leave the page, never lose form state.
3. **Merge the duplicate views.** `/resources/vehicles` becomes resource *master
   data* (add/edit vehicles, QR ประจำรถ) only; live status/GPS/photos live solely
   in ศูนย์ควบคุม. Kill the `/resources` hub page — link คนขับ/รถ directly from the
   project **ทรัพยากร** tab.
4. Retire or wire up orphans: `/recovery` → a section inside ศูนย์ควบคุม;
   `/portal` → project-scoped; delete `/superadmin/organizations`.

### Phase R — driver app correctness  *(highest priority)*
5. **One GPS button.** Remove the fake phase button; `<DriverLocationShare>`'s
   button is the only one, and pressing it starts the watch immediately.
6. **Honest GPS light** driven by the real watch: `live` on a fresh fix,
   `stale` >30 s, `off` on stop/deny/error — lifted from `<DriverLocationShare>`
   state, not set optimistically.
7. **งานวันนี้** — list the driver's other assignments for today under the current
   job; finishing one surfaces the next (no new QR scan).
8. **Proof of delivery** — reuse the photo pipeline at `completed`: photo + note,
   geotagged; shows in the centre next to the pre-flight evidence.

### Phase S — automation the market expects
9. **Geofence arrival** — auto-fire `arrived_pickup` / `arrived_dropoff` when the
   driver's GPS enters ~150 m of the stop (driver can still tap manually).
10. **ETA** from last GPS + straight-line/Directions API, shown per row in the
    fleet board and on the customer link.
11. **Push notifications** via the Expo app (FCM/APNs) for new job, message,
    route change — replaces polling for backgrounded phones.
12. **Public tracking link** per assignment — read-only map + ETA for the
    passenger/customer.

### Phase T — scale-up ergonomics
13. CSV import for drivers / vehicles / jobs.
14. Job templates + recurring schedules.
15. Exception thresholds (late > N min, idle > N min, off-route) with an alert feed.

**Suggested order: Q → R → S → T.** Q and R are correctness/blocker work; S is
what makes it competitive; T is volume.

---

## 4b. 🔴 Driver progress does not survive a refresh

Reported by the user: *"รีเฟรชหน้า แล้วต้องมากดแชร์โลเคชั่นใหม่ งานกลับมาจุดเริ่มต้น"*.

**Confirmed — every piece of driver progress lives in React `useState` only.
Nothing is persisted, and nothing is re-derived from the server on load:**

| state | on refresh | consequence |
|---|---|---|
| `phase` | → `"ready"` | GPS card disappears, back to the start button |
| `tripStep` | → `0` | "ถึงจุดรับแล้ว" reappears even after the driver reported it |
| `<DriverLocationShare>.state` | → `"idle"` | the `watchPosition` watch is gone; must press again |

The server **already knows all of it** — it's just never read back:
- `driver_checkins` (status `ready`) → `driverAccess.activated` (used for the
  pre-flight gate, so that part *does* survive)
- `assignment_status_updates` → the exact step the driver last reported
- `gps_locations` → last ping + `sharing_event`

`/api/driver/updates` even returns `assignmentStatus`, and `<DriverTaskView>`
ignores it.

This also means: screen lock, tab switch, a network blip, or the browser
reclaiming memory all silently drop the driver off the map — the centre just sees
GPS go stale with no explanation.

### Fix
1. **Derive, don't remember.** Add the driver's latest reported step to
   `getDriverAssignmentByToken`; initialise `tripStep` from it. Completed steps
   stay completed after any reload.
2. **Delete the fake `ready` phase** (same as R5) — after pre-flight the driver
   lands straight on the working screen.
3. **Auto-resume GPS.** Record consent per token in `localStorage`; on mount, if
   consented and the Permissions API reports `granted`, start `watchPosition`
   immediately — no second prompt, no button.
4. **Resume on wake.** Restart the watch on `visibilitychange` → visible, and on
   `online`, so returning to the tab re-arms tracking.
5. **Screen Wake Lock** while sharing, so the phone doesn't sleep the tab.
6. **Retry queue on the web driver** (the Expo app already has one): failed
   status/message posts go to `localStorage` and flush when the network returns.

---

## 4c. Reducing the centre operator's process

Repetitive work the operator does today that should be removed:

| today | should be |
|---|---|
| pre-create a Call Sign per job | auto-generated (Q1) |
| generate QR one assignment at a time from a dropdown | **bulk generate** for all ready jobs + a printable sheet |
| PIN shown once in React state — lost on refresh → revoke + regenerate | PIN **retrievable** on the assignment row (re-reveal, or regenerate PIN without invalidating the QR) |
| eyeball 30 vehicle cards to find problems | **exception feed / filter**: late, no GPS, unread message — "N คันต้องดู" is the default view |
| chase drivers for status | geofence auto-status (S9) |
| retype the same job every day | **duplicate / template** a job, recurring schedules |
| message vehicles one at a time | **broadcast** to all active drivers in a project |
| fill every field on a new job | prefill pickup/dropoff/time from the mission |

## 5. Fastest wins (can ship in one pass)
- Call sign auto-generate + inline create → unblocks the whole product.
- Driver state survives refresh + auto-resume GPS → stops silently losing drivers.
- Remove the duplicate GPS button + fix the status light.
- Merge `/resources/vehicles` live view into ศูนย์ควบคุม → one less duplicate menu.
- Driver "งานวันนี้" list.

**Implementation instructions for another agent: `952-agent-handoff-flow-fixes.md`.**
