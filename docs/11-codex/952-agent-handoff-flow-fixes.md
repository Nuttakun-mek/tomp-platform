# Agent handoff — flow + driver-stability fixes

Implementation instructions for the findings in `951-flow-ux-audit-and-plan.md`.
Written so an agent with no prior context can execute it. Do the tasks in order;
each ends with a verifiable, independently shippable deliverable.

---

## 0. Orientation (read before touching anything)

**Stack.** Next.js 15 App Router + Supabase (Postgres + RLS + Storage), npm
workspaces: `apps/web`, `apps/mobile-driver` (Expo), `packages/types`,
`packages/driver-core`.

**Route groups.**
- `app/(app)/*` — authenticated workspace, wrapped in `<AppShell>`; the group
  layout `app/(app)/layout.tsx` is the **auth gate** (`getCurrentUserProfile()` →
  `redirect("/login")`).
- `app/driver/*`, `app/login`, `app/no-access` — outside the group, no shell.

**Non-obvious rules — violating these breaks production:**
1. `vercel.json` uses the legacy `builds` + `routes` config. It **bypasses
   Next.js middleware entirely on production**, and **every nested dynamic route
   needs its own explicit rewrite entry**. If you add a route like
   `/foo/[id]`, add a `routes` entry or it 404s at the Vercel edge. Prefer a
   `?query=` page + a rewrite, matching `/projects/([^/]+)` →
   `/apps/web/project?projectId=$1`.
2. Because middleware is bypassed, **auth must be enforced in server code**:
   the `(app)` layout for pages, `lib/api/guard.ts` `guardProjectApi()` for
   mission-control API routes, `lib/api/driver-token.ts`
   `resolveDriverTokenContext()` for driver write routes.
3. `"use server"` files may only export **async functions**. A `const` export
   breaks the build.
4. Reads go through `resolveReadClient()` (`lib/supabase/scoped-client.ts`) —
   RLS-bound when a session exists, service-role otherwise. Writes use
   `getSupabaseWriteClient()` (service role, bypasses RLS) so **actions must do
   their own permission checks** (`requirePermission`).
5. Per-request singletons are wrapped in React `cache()` (`resolveReadClient`,
   `getCurrentUserProfile`, `getViewerAccess`, `getProjects`,
   `loadRolePermissions`). Keep new hot-path reads consistent with that.
6. Row → object mapping helpers live in `lib/data/row.ts`
   (`rowText`/`rowLoose`/`rowNumber`/`rowObject`/`Row`). Use them, don't re-declare.

**Verify every task with:**
```bash
cd apps/web && npm run typecheck && npm run lint
cd ../.. && npm test
```
**Full build (Windows gotcha):** stop the dev server, then
`rm -rf apps/web/.next && cd apps/web && npm run build`. Without the clean you hit
a recurring `ENOENT … rename '.next/export/500.html'`. The build takes ~6 min
locally; GitHub Actions (`.github/workflows/ci.yml`) runs the same checks faster.

**Migrations.** Add `database/migrations/00NN_name.sql`, then
`node scripts/apply-migrations.mjs --yes` (applies to cloud) and
`node scripts/sync-supabase-migrations.mjs` (mirrors to `supabase/migrations/`).
Latest applied: `0023`.

**Do not push or deploy unless the user asks.** Vercel auto-deploys `main`.

---

## Task 1 — Call Sign is a hard blocker (do this first)

**Problem.** `createAssignmentAction` requires `callSignId`;
`<CreateAssignmentForm>` is disabled when `callSigns.length === 0`; there is **no
action and no UI anywhere** that creates a `call_signs` row (only
`app/actions/pilot-smoke-test.ts:239` inserts one). A user starting from an empty
system cannot create a job.

**Files**
- Create: `apps/web/app/actions/call-signs.ts`
- Modify: `apps/web/components/assignments/create-assignment-form.tsx`
- Modify: `apps/web/app/(app)/assignments/page.tsx` (pass `projectCode`)

**Steps**

1. `app/actions/call-signs.ts` — `"use server"`, export only async functions:

```ts
"use server";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { requirePermission } from "@/lib/auth/rbac";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

// Auto-numbers as <PROJECT_CODE>-01, -02 … when no label is given, so the
// dispatcher never has to invent one.
export async function createCallSignAction(input: unknown): Promise<ActionResult> {
  const data = (input ?? {}) as { projectId?: string; callSign?: string; projectCode?: string };
  const projectId = String(data.projectId || "");
  if (!projectId) return actionFailure("ไม่พบโครงการ");

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const permission = await requirePermission(projectId, "assignment.create");
  if (!permission.allowed && mode !== "service_role") {
    return actionFailure(permission.reason || "ไม่มีสิทธิ์สร้าง Call Sign");
  }

  let label = String(data.callSign || "").trim();
  if (!label) {
    const { data: rows } = await client
      .from("call_signs").select("call_sign").eq("project_id", projectId);
    const prefix = String(data.projectCode || "UNIT").trim() || "UNIT";
    label = `${prefix}-${String((rows?.length ?? 0) + 1).padStart(2, "0")}`;
  }

  const { data: row, error: insertError } = await client
    .from("call_signs")
    .insert({ project_id: projectId, call_sign: label, status: "active", metadata: {} })
    .select().single();

  if (insertError) return actionFailure(getDatabaseErrorMessage(insertError, "สร้าง Call Sign ไม่สำเร็จ"));
  return actionSuccess({ callSign: row });
}
```

2. In `<CreateAssignmentForm>`: add a `projectCode` prop; next to the Call Sign
   `<select>` render a **“＋ สร้าง Call Sign”** button that calls the action and
   pushes the new row into local state so it is selected immediately — the
   dispatcher never leaves the form. Drop `callSigns.length > 0` from `canCreate`
   once creation is inline.
3. Pass `projectCode={activeProject.projectCode}` from `assignments/page.tsx`.

**Verify.** From an empty project: create mission → open สร้างงาน → press
“＋ สร้าง Call Sign” → it appears selected → the job saves. No page navigation.

---

## Task 2 — Driver progress must survive a refresh

**Problem.** All driver progress is React `useState`
(`components/driver/driver-task-view.tsx:46-55`): `phase` → `"ready"`,
`tripStep` → `0`, and `<DriverLocationShare>` state → `"idle"` on every reload.
Screen lock, tab switch or a network blip silently drops the driver off the map.
The server already stores the truth in `assignment_status_updates`; the driver
page never reads it back.

**Files**
- `apps/web/lib/data/driver-access.ts` (add `latestStatus` to
  `DriverAccessAssignment`, both the Supabase and the postgres path)
- `apps/web/app/api/driver/updates/route.ts` (return it)
- `apps/web/components/driver/driver-task-view.tsx`
- `apps/web/components/driver/driver-location-share.tsx`

**Steps**

1. `driver-access.ts` — add `latestStatus?: { status: string; at: string }`,
   populated from the newest `assignment_status_updates` row for this assignment
   (mirror how `messages` was added: one more entry in the existing
   `Promise.all`, one more query in the postgres branch).
2. `<DriverTaskView>` — initialise from it instead of `0`:

```ts
const TRIP_ORDER = ["arrived_pickup", "passenger_onboard", "completed"] as const;
const resumedStep = driverAccess.latestStatus
  ? TRIP_ORDER.indexOf(driverAccess.latestStatus.status as (typeof TRIP_ORDER)[number]) + 1
  : 0;
const [tripStep, setTripStep] = useState(Math.max(0, resumedStep));
```
   Also apply the polled `data.latestStatus` so a step taken on another device
   shows up.
3. **Delete the `phase` state and the fake `ready` screen.** The button at
   `driver-task-view.tsx:235` only calls `setPhase("sharing")` — it does **not**
   start GPS; `<DriverLocationShare>` has the real one. Render the working screen
   (deep link + `<DriverLocationShare>` + trip steps) directly.
4. **Auto-resume GPS** in `<DriverLocationShare>`: on successful start write
   `localStorage["dgps:" + token] = "1"`; on mount, if that flag is set and
   `navigator.permissions.query({ name: "geolocation" })` reports `granted`, call
   `startSharing()` immediately. Clear the flag in `stopSharing()`. Wrap all
   storage access in try/catch.
5. **Resume on wake:** re-arm on `visibilitychange` → visible and on `online`.
6. **Screen Wake Lock** while sharing (`navigator.wakeLock.request("screen")`,
   feature-detected, released on stop) so the phone doesn't sleep the tab.

**Verify.** Start sharing → reload the page: GPS resumes with no prompt and no
button press, and the completed trip steps are still green. Tap
"ถึงจุดรับแล้ว" → reload → it is still done and the current step is
"รับผู้โดยสารแล้ว".

---

## Task 3 — Honest GPS status light

**Problem.** `setGpsLight("live")` fires on the fake button *before* any
permission prompt, and is never reset on denial, error or staleness
(`driver-task-view.tsx:55,236`). The header can read "GPS สด" while nothing is
shared.

**Steps.** Give `<DriverLocationShare>` an `onStatusChange` callback and drive
the header light from the real watch: `live` on a fix newer than 30 s, `stale`
when older, `off` on idle/stopped/denied/error. Delete the optimistic
`setGpsLight("live")` call.

**Verify.** Deny location permission → the light shows "ยังไม่แชร์ GPS" (never
"สด"). Turn GPS off mid-trip → it degrades to "GPS ช้า" then "ขาดสัญญาณ".

---

## Task 4 — Offline retry queue for the web driver

**Problem.** `apps/mobile-driver` has `src/services/offline-queue.ts`; the web
driver has none. A failed status tap shows an error banner and is lost.

**Steps.** Add `apps/web/lib/driver/outbox.ts`: append failed
status/message/issue payloads to `localStorage`, flush on `online` and on a 30 s
timer, cap the queue (~20) and dedupe by id. Wire it into `advanceTrip`,
`sendMessage`, `reportIssue` in `<DriverTaskView>`. Show a small
"ค้างส่ง N รายการ" chip while non-empty.

**Verify.** Go offline in devtools → tap a status → chip shows 1 → go online →
chip clears and the centre receives the update.

---

## Task 5 — Driver "งานวันนี้"

**Problem.** One QR opens exactly one job; the driver cannot see what is next and
needs a new QR + PIN for every job.

**Steps.** Add `getDriverDayAssignments(driverId, date)` in
`lib/data/driver-access.ts` (same project, same driver, `start_time` today,
excluding cancelled). Return it from `getDriverAssignmentByToken` and
`/api/driver/updates`. Render a collapsible "งานวันนี้ (N)" in `<DriverTaskView>`
listing call sign · pickup → dropoff · time · status. When the current job hits
`completed`, surface the next one with a "เริ่มงานถัดไป" button that swaps the
active job in place (no new scan).

**Verify.** Two assignments for the same driver today → finishing the first shows
the second without re-scanning.

---

## Task 6 — Collapse the duplicate operator views

**Problem.** After the Phase H/K rework `/mission-control` (`<FleetBoard>`) and
`/resources/vehicles` (`<VehicleOperationsBoard>` + `<VehicleFleetMap>`) show the
same live data — vehicle, driver, status, GPS, photos.

**Steps.**
- `/resources/vehicles` → **master data only**: vehicle list, create/edit, QR
  ประจำรถ. Remove `<VehicleFleetMap>` and the live status/GPS/evidence blocks
  (live status lives only in ศูนย์ควบคุม).
- Delete the `/resources` hub page; link คนขับ / รถ directly from the project
  **ทรัพยากร** tab (`<ProjectWorkspaceTabs>`).
- Move `/recovery` in as a section of ศูนย์ควบคุม, or drop it — it is currently
  unreachable from any menu.
- `/portal` reads `projects[0]`; make it project-scoped like the rest.

**Verify.** No screen shows the same live vehicle status twice; every remaining
page is reachable from the project tabs.

---

## Task 7 — Reduce repetitive centre work

Ordered by payoff; each is independent.

1. **Bulk QR** — generate for every ready assignment at once + a printable sheet
   (call sign, QR, PIN per row). Today it is one dropdown selection at a time.
2. **Recoverable PIN** — the PIN is only in React state and lost on refresh, so
   the operator must revoke and regenerate. Add "แสดงรหัสอีกครั้ง" /
   "ออกรหัสใหม่" on the assignment row **without invalidating the QR** (rotate
   `metadata.pinHash` only).
3. **Exception-first view** — default the fleet board to "N คันต้องดู"
   (late / no GPS / unread message) instead of all 30 cards.
4. **Duplicate job** — "ทำซ้ำงานนี้" copying mission, driver, vehicle, route with
   a new time.
5. **Broadcast message** to every active driver in the project (one call to
   `sendDriverNotificationAction` per active assignment).
6. **Prefill** pickup/dropoff/time on a new assignment from the selected mission.

---

## Later phases (design first, not ready to implement)

- **Geofence auto-status** — fire `arrived_pickup` when a ping lands within ~150 m
  of the stop. Needs lat/lng on stops; today they are free-text strings in
  `assignment.metadata`, so a geocoding step comes first.
- **ETA** from last GPS + Directions API; show per fleet-board row.
- **Push notifications** via the Expo app (FCM/APNs) — replaces 15 s polling for
  backgrounded phones. Requires the EAS build (user's Expo account).
- **Public tracking link** per assignment for the passenger.
- **CSV import** for drivers / vehicles / jobs.

## Known environment items the user must do
- `eas build` of `apps/mobile-driver` (background GPS).
- Supabase dashboard: disable open sign-ups, set Site URL, rotate the access token.
- Vercel env: confirm `TOMP_SCOPED_READS`, `DRIVER_ACCESS_TOKEN_SECRET`,
  `TOMP_ENABLE_POSTGRES_FALLBACK`.
- Migrating `vercel.json` off the legacy config needs Root Directory =
  `apps/web` set in the Vercel dashboard; doing so would make the middleware run
  and let the hand-rolled guards be simplified.
