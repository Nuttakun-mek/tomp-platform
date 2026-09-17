# 981 — Screen cleanup: overview, dispatch, mission control

**Date:** 2026-09-17
**Status:** design, awaiting review
**Wave:** 1 of 3 (see "What this is not" at the end)

## Why

The operator asked what several screen sections are *for*. Reading the code, three
of them turned out to answer nothing anyone needs during an operation:

- **ประกาศใช้แผน** locks a plan through `publish_locks` when a project reaches
  published/operating/closing/closed. But all nine production projects are still
  `status = 'planning'` — nobody has ever published — and nothing on the driver
  path checks project status: QR issuing, GPS, and messages all work without it
  (`lib/api/driver-token.ts`, `lib/data/driver-current-assignment.ts`, and
  `app/actions/driver-access.ts` contain no such check). It occupies the left
  half of the overview and gates nothing.
- **งานที่จัดสรร** is twenty lines that print "พร้อมใช้งาน X จาก Y งาน" and a
  link. `ProjectReadinessSummary`, directly above it, counts the same jobs again.
- **มุมมองปฏิบัติการของรถ** (`VehicleMonitorPanel`) lists GPS freshness, message
  counts, the current job, and its own message form — all of which `FleetBoard`
  already shows. One is keyed by vehicle and the other by driver, but a Call Sign
  *is* one driver in one vehicle, so the two lists have the same rows.

What the overview does not show is anything about the operation itself: how many
vehicles, how many crewed units, who is reporting a position.

## Decisions taken

| Question | Decision |
|---|---|
| ประกาศใช้แผน | Move to the ตั้งค่า tab. The lock is real machinery; it just does not belong on a daily screen. |
| "ความพร้อมโครงการ %" | Replace. The formula is `min(100, assignments ÷ missions × 100)` — jobs per mission dressed as a percentage. |
| Cost per driver/vehicle | Not here. It belongs with duty hours, since a rate with no hours to multiply is a field that lies. |

## Scope

Four changes. Every file is under `apps/web/**`, which the web agent owns — the
operator directed this work to the mobile track explicitly, so the boundary note
in `978` needs updating when this lands.

---

### 1. Overview becomes an operational summary

**Files**
- Modify: `apps/web/app/(app)/project/page.tsx` (`OverviewView`, `SettingsView`)
- Create: `apps/web/lib/domain/project-operation-summary.ts`
- Create: `apps/web/lib/domain/project-operation-summary.test.ts`
- Create: `apps/web/components/projects/project-operation-summary.tsx`
- Delete: `apps/web/components/projects/project-assignment-board.tsx`
- Delete: `apps/web/components/projects/project-readiness-summary.tsx`

`OverviewView` drops `ProjectPublishPanel`, `ProjectAssignmentBoard`, and
`ProjectReadinessSummary`, and keeps `ProjectMissionBoard` and the collapsed
คำขอเปลี่ยนแปลง section. In their place a single summary row reports:

- รถในโครงการ — `getProjectVehicles(projectId).length`
- คนขับในโครงการ — `getProjectDrivers(projectId).length`
- หน่วยพร้อมออกงาน — active call signs with both a driver and a vehicle, over
  all active call signs. This is the same `crewed` test the dispatch page uses
  (`Boolean(unit.driver && unit.vehicle)`), so the two screens cannot disagree.
- กำลังส่งตำแหน่ง — locations whose `gpsFreshness(...)` is `live`.

**The layout must change with the contents.** Today `OverviewView` is a two
column grid, `xl:grid-cols-[0.72fr_1.28fr]`, whose left column holds exactly the
two panels this change deletes. Removing them without touching the grid leaves a
half-empty page with `ProjectMissionBoard` stranded in the right-hand column. The
grid goes away: the summary row becomes a full-width band of four figures at the
top, `ProjectMissionBoard` sits full width beneath it, and the collapsed
คำขอเปลี่ยนแปลง section stays last. One column, three stacked blocks, in the
order an operator reads them — where the project stands, what work is planned,
what has been asked to change.

The computation goes in `lib/domain/project-operation-summary.ts` as a pure
function, not in the component, because that is the part worth testing and the
codebase already keeps this kind of rule under `lib/domain`:

```ts
export interface ProjectOperationSummary {
  vehicles: number;
  drivers: number;
  crewedUnits: number;
  totalUnits: number;
  reportingPositions: number;
}

export function summariseProjectOperation(input: {
  vehicles: { id: string }[];
  drivers: { id: string }[];
  callSigns: { status: string; driverId?: string | null; vehicleId?: string | null }[];
  locations: { recordedAt: string; sharingEvent?: string | null; metadata?: Record<string, unknown> }[];
  now: number;
}): ProjectOperationSummary;
```

`OverviewView` is a server component, so the number is rendered once into the
HTML and never re-computed on the client — there is no hydration mismatch, but
the row must be labelled "ข้อมูล ณ เวลาที่เปิดหน้า" so it does not read as live.
Mission control is where live is.

`SettingsView` gains `getOperationDaysByProjectId(projectId)` and
`getProjectById(projectId)`, computes `checkProjectPublishReadiness(...)`, and
renders `<ProjectPublishPanel projectId readiness />` after the members section
and before โซนอันตราย.

**Before deleting** either component, confirm nothing else imports it.

---

### 2. Dispatch: the fleet link folds away

**Files**
- Modify: `apps/web/components/assignments/call-sign-access-panel.tsx`

`ProjectFleetAccessCard` currently renders its own `<section>` with its own
kicker, heading, description, and "มีลิงก์ใช้งานอยู่" badge. Wrapping that in
`CollapsibleSection` as-is would stack two headers, so the component's outer
section and header block are removed and `CollapsibleSection` carries them
instead:

```tsx
<CollapsibleSection
  title="ลิงก์ติดตามรถทั้งโครงการ"
  description="ลิงก์อ่านอย่างเดียวสำหรับลูกค้าหรือผู้ติดตามภายนอก ไม่แสดงเบอร์โทรคนขับ"
  storageKey={`dispatch.${projectId}.fleetlink`}
  defaultOpen={!projectObserverLink}
  badge={projectObserverLink ? <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800">มีลิงก์ใช้งานอยู่</span> : null}
>
  <ProjectFleetAccessCard projectId={projectId} callSigns={callSigns} projectObserverLink={projectObserverLink} />
</CollapsibleSection>
```

`defaultOpen={!projectObserverLink}` is the point: a project that already has a
link does not need the issuing form in the way every day, and a project with no
link still sees the step it has not taken. `CollapsibleSection` already remembers
the open state per viewer in `localStorage`, so an operator who wants it open
keeps it open.

The card loses its teal frame and gains the standard `enterprise-panel` frame
that `CollapsibleSection` provides. That is intended — it now matches the five
other collapsible sections in the product.

---

### 3. Mission control: shorter driver cards

**Files**
- Modify: `apps/web/components/mission-control/fleet-board.tsx`

The collapsed header is three stacked lines. The middle one is the long one:

```tsx
{group.vehicle?.plateNumber ?? "ยังไม่ระบุรถ"} · {group.jobs.map((job) => job.label).join(", ")}
```

Every job label, comma-joined, on a card that lists those same jobs in full the
moment it is opened. It becomes one line carrying facts that are not repeated
elsewhere on the card — plate, freshness, last-seen — and the third line (the
freshness pill and the time pill) goes away, since the coloured dot at the left
of the header already encodes freshness.

The expanded panel opens with four key/value rows: คนขับ, เบอร์โทร, รถ, GPS
ล่าสุด. Three of the four repeat the header — the driver's name *is* the card
title, the plate and the GPS time are on line two. The whole block is deleted.
The phone number stays reachable through the โทรหาคนขับ button already below it.

Net: header 3 lines → 2, and the expanded panel loses four rows and gains one
(see change 4).

---

### 4. Mission control: fold the vehicle view into the driver card

**Files**
- Delete: `apps/web/components/mission-control/vehicle-monitor-panel.tsx`
- Modify: `apps/web/app/(app)/mission-control/page.tsx`
- Modify: `apps/web/lib/data/vehicle-operations.ts`
- Modify: `apps/web/components/mission-control/fleet-board.tsx`

Remove the panel, its `CollapsibleSection` wrapper, its import, and the
`getVehicleOperationProfilesByProjectId(activeProject.id)` entry in the page's
`Promise.all` with its `vehicleProfiles` binding.

That call is the reason this is worth more than tidiness. It runs on **every**
mission-control load even though the section defaults to closed, and inside it
fans out to `getProjects()`, `getDrivers()`, `getLatestDriverLocations(100)`,
`getMissionsByProjectIds(...)`, plus one `getLatestAssignmentStatuses` and one
`getVehicleEvidenceByProjectId` per project. Deleting the panel deletes that
work from every page view.

`getVehicleOperationProfilesByProjectId` then has no caller and is deleted too.
`getVehicleOperationProfileById` (vehicle detail page) and
`getVehicleOperationProfiles` (vehicle list page) both keep their consumers and
stay.

The two things the panel had that `FleetBoard` lacks move into the expanded
driver card, on the row that already holds โทรหาคนขับ and เปิดตำแหน่งใน Google
Maps: the vehicle status badge, and a `ดูรายละเอียดรถ` link to
`/resources/vehicles/${group.vehicle.id}`, both rendered only when
`group.vehicle` exists.

**Check before deleting:** `VehicleMessageForm` is imported by
`vehicle-monitor-panel.tsx`. If that is its only consumer it is orphaned and
should be deleted with it — `CommsConsole` is where the control room sends
messages. Grep first; do not assume.

## Testing

- `summariseProjectOperation` gets unit tests: a project with no resources, one
  where some call signs are half-crewed, one where a call sign is inactive (it
  must not count toward either side of X/Y), and one where a location is stale
  (it must not count as reporting).
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` in
  `apps/web` must all pass. The build matters here: four files are deleted and a
  stale import fails at build time, not typecheck time.
- Manual: open a project with no fleet link and confirm the dispatch section is
  expanded; issue a link, reload, confirm it is collapsed with the badge; toggle
  it and reload to confirm the choice sticks.

## Risks

- Deleting a component that something else imports breaks the build. Every
  deletion in this spec is gated on a grep first.
- Moving `ProjectPublishPanel` to ตั้งค่า means an operator who published from
  the overview has to find it again. The tab is one click away and the panel
  keeps its heading, so it stays findable by name.

## What this is not

Three further waves came out of the same conversation and are deliberately not
in this spec:

- **Wave 2 — เวลาและค่าใช้จ่าย.** Daily clock-in/clock-out against a multi-day
  mission, accumulated hours, a cost rate per driver and per vehicle, and
  warnings when either the planned window or the budget is exceeded. The operator
  was explicit: **warn only, never strip the job from the driver or the vehicle** —
  an overrun is a signal for a person to act on, not a rule the system enforces.

  Time against the planned window is shown as a colour: normal inside the window,
  **amber at 80% of it**, red past it. The amber threshold is the one that
  carries the work. It exists so the control room can call the driver and start
  wrapping the job up *before* the window closes — by the time the bar is red the
  moment to act has already passed. So amber must read as "do something now",
  not as a milder red; a design that makes red the loudest state gets this
  backwards. The same three-state rule applies to cost against budget.

  Foundations that already exist: `project_days` (operation_date, day_number,
  status) and `driver_location_sessions` (started_at/stopped_at — but that is GPS
  sharing, not duty, and a driver can work without sharing). A new table is
  needed. Note that the driver page is web inside the WebView, so a clock button
  there ships by deploy, with no app rebuild.
- **Wave 3 — ศูนย์ควบคุม: ข้อความ.** Bubbles that size to their content and sit
  left for inbound and right for outbound; scrollback past the current hard
  `slice(-4)` in the driver card; and centre-to-driver photos, which the outbound
  message type has no field for today while inbound already carries attachments.
- **Wave 4 — ทรัพยากร.** Creating a person and a vehicle together, with the Call
  Sign and QR issued afterwards on the dispatch page.
