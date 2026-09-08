# Code review — streamlining, clean code, bug fixes

Response to "ตรวจสอบโค้ดทั้งหมด … คล่องตัวขึ้น … ไม่มีบั๊ก". Committed locally,
**not pushed** (per instruction).

## Bugs / security found + fixed

### 1. Unauthenticated write access to `/api/driver/{status,issue,readiness}` 🔴
These 3 routes took a raw JSON body (`{ projectId, assignmentId, driverId, … }`)
and passed it straight to the write action **with no token check** — anyone who
knew or guessed the UUIDs could post status updates / check-ins / issue reports
for any assignment (the actions use the service-role client → bypass RLS).
The web `<DriverTaskView>` calls the server actions directly (protected by Next's
action mechanism), so only the raw routes were exposed — used by the mobile app.
- **Fix:** `lib/api/driver-token.ts` `resolveDriverTokenContext()` — the routes now
  require the driver token (`x-driver-token` header / `?token=` / body) and derive
  `projectId` / `assignmentId` / `driverId` from it; body ids are ignored.
- `apps/mobile-driver`: `submitReadiness/Status/Issue(token, input)` send the
  header; `App.tsx` + `offline-queue.ts` updated.

### 2. Unauthenticated read of `/api/mission-control/{comms,locations}` 🔴
No auth check — an anon caller could pull driver messages, GPS and evidence for
any `projectId`.
- **Fix:** `lib/api/guard.ts` `guardProjectApi()` — both routes now 401 without a
  session. Per-project filtering is still RLS on the scoped read client.

## Performance / streamlining

### 3. `React.cache()` on per-request singletons
`resolveReadClient()` (→ `auth.getUser()`) ran **~19×** on a mission-control page
load — once per `lib/data/*` call. Now `cache()`-wrapped so the auth check + client
resolve once per request. Same for `getScopedDataClient`, `getCurrentUserProfile`,
`getViewerAccess`, `getProjects`, `loadRolePermissions`.

### 4. Polling churn on the control centre
- `LiveLocationMap`: a **1 s** clock re-rendered the whole map every second, plus a
  7 s location poll → 10 s / 10 s.
- `FleetBoard`: 5 s clock + 10 s poll → 15 s / 12 s.
- Net: far fewer re-renders and requests while the labels stay accurate to ~10 s.

## Clean code

### 5. Shared row helpers
`text()` / `str()` / `metadata()` were copy-pasted in 6 `lib/data/*` files.
New `lib/data/row.ts` (`rowText`, `rowLoose`, `rowNumber`, `rowObject`, `Row`);
migrated `driver-comms`, `assignment-status`, `vehicle-evidence`, `project-members`.
(The older `driver-access` / `mappers` / `locations` kept their local copies for
now — load-bearing, separate pass.)

### 6. (from the earlier commit) ~52 dead component files already deleted;
no `console.log` or `any` in app code.

## Verify
typecheck 0 (web + mobile) · lint 0 · web 54/15 · driver-core 14/5 · build 0.

## Still open (needs the user)
- `/api/admin/pilot-infrastructure` is still open (returns only table-readiness,
  not business data; gating it breaks the production smoke check). Low risk.
- `vercel.json` migration so the real Next.js middleware runs (would make the
  hand-rolled layout/route guards redundant).
