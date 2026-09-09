# TOMP system effectiveness audit and agent execution plan

Audit date: 2026-09-09 (Asia/Bangkok)  
Audited commit: `b7ed87853ec938767b658774ae4f82c5e3d3479a`  
Scope: operator Web, Driver Web/API, Supabase data/RLS, production routing, mobile readiness, UX, performance, tests, and duplication.

This document supersedes assumptions in older handoff notes where the current code proves otherwise. It is an implementation brief for the next Agent. Do not mark a phase complete from typecheck/build alone; complete the acceptance tests listed here.

## 1. Executive verdict

The repository compiles and its unit-test baseline is healthy, but it is not ready for an unsupervised production pilot. The main risks are authorization boundaries, driver-token authentication, mixed demo/live data, non-atomic writes, and smoke tests that treat redirects as success. The UI has improved visually, but the core project, assignment, and command-center workflows remain too long and dense, especially on mobile.

Current evidence-based readiness:

| Area | Score | Verdict |
|---|---:|---|
| Build and static quality | 90/100 | Typecheck, lint, unit tests, and build pass |
| Operator workflow | 58/100 | Main objects exist, but the workspace is form-heavy and feedback is inconsistent |
| Driver workflow | 45/100 | QR/PIN UI exists, but API authorization can bypass PIN |
| Data integrity | 48/100 | Real database is connected, but fallbacks and non-atomic commands can misrepresent state |
| RBAC/security | 35/100 | RLS exists, but service-role authorization bypasses are present in application actions |
| Mission Control | 60/100 | Map/feed concepts work; information density, empty state, persistence, and scale proof are incomplete |
| Mobile readiness | 42/100 | Expo source exists; it is outside root CI and has no verified EAS build |
| End-to-end confidence | 25/100 | No authenticated browser-to-database E2E suite |
| Internal pilot readiness | **51/100** | Guided engineering demo only; no-go for unsupervised pilot |

## 2. Audit evidence

Commands and observations used for this audit:

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS: Web 19 files/79 tests; driver-core 5 files/14 tests; total 24 files/93 tests |
| `NEXT_TELEMETRY_DISABLED=1 npm run build` | PASS |
| `npm run smoke:production` | Script exits PASS, but authenticated routes return `307` and are incorrectly accepted |
| `npm run db:migrate:dry` | Connected to Supabase PostgreSQL 17.6; nothing pending; checksum drift detected in 4 applied migrations |
| Production `/api/health` | `200`, Supabase server config present, version `2026.09.09.1200` |
| Visual matrix | Local screenshots reviewed at 1440 px and 390 px for projects, project workspace, assignments, Mission Control, login, resources, superadmin, and driver entry |

Production data observed during the audit is nearly empty: 1 organization, 1 profile, 1 project, 3 drivers, 3 vehicles, 1 timeline event, 1 project member, and zero missions, assignments, QR tokens, check-ins, status updates, or GPS locations. Therefore the current production state does not prove the complete QR-to-GPS workflow.

## 3. Confirmed findings

### P0-1: service-role transport bypasses application authorization

Multiple server actions use this pattern:

```ts
if (!permission.allowed && mode !== "service_role") return actionFailure(...)
```

When production writes use the normal server-only service-role client, a denied user is allowed to continue. Service role is a database transport credential; it must never be treated as user authorization.

Confirmed examples:

- `apps/web/app/actions/assignments.ts:25`, `:78`, `:148`
- `apps/web/app/actions/resources.ts:26`, `:84`
- `apps/web/app/actions/publish.ts:21`
- `apps/web/app/actions/projects.ts:96`, `:125`
- `apps/web/app/actions/change-requests.ts:35`, `:81`
- `apps/web/app/actions/call-signs.ts:39`
- `apps/web/app/actions/missions.ts:120`
- `apps/web/app/actions/incidents.ts:18`, `:71`
- `apps/web/app/actions/driver-access.ts:207`, `:293`

Impact: authenticated users may execute project-scoped writes beyond their assigned role whenever service-role mode is enabled.

Required correction: authorize the current actor unconditionally before obtaining or using the privileged data client. Introduce a single command guard returning an `ActorContext`; do not repeat mode-dependent checks.

### P0-2: Driver API can bypass the PIN and device gate

The Web page checks the PIN cookie in `apps/web/app/driver/page.tsx:51-54`, but API routes resolve only the raw QR token through `apps/web/lib/api/driver-token.ts:15-31`. The PIN cookie is scoped to `/driver` in `apps/web/app/actions/driver-pin.ts:144-151`, so it is not sent to `/api/driver/*`. Assignment and update endpoints also accept the token in query strings (`apps/web/app/api/driver/assignment/route.ts:9-18`, `apps/web/app/api/driver/updates/route.ts:10-16`).

Legacy tokens without a PIN hash are explicitly accepted in `apps/web/app/actions/driver-pin.ts:48-52` and `:101-105`.

Impact: possession of a QR URL is sufficient to call readiness, status, issue, assignment, updates, and location endpoints directly without completing the visible PIN flow. Query-string tokens may also leak through logs, browser history, or referrers.

Required correction: exchange the one-time QR token plus PIN for a short-lived driver session. Browser sessions use a signed `HttpOnly`, `Secure`, `SameSite` cookie valid for the API path; mobile uses a short-lived scoped bearer token stored in SecureStore. Bind it to token ID, assignment, driver, device, expiry, and revocation version. Reject raw QR tokens on operational endpoints after exchange. Revoke or migrate every legacy no-PIN token.

### P0-3: demo data is silently substituted for live errors

Read helpers return `demoKernel` when configuration is absent, a query fails, or a row is not found:

- `apps/web/lib/data/projects.ts:38-58`
- `apps/web/lib/data/missions.ts:11-37`
- `apps/web/lib/data/call-signs.ts:11-18`
- `apps/web/lib/data/resources.ts:11-31`
- `apps/web/lib/data/assignments.ts:55-74`
- `apps/web/lib/data/timeline.ts:24-29`

In addition, `apps/web/components/change/change-request-list.tsx:3-19` always renders `CR-demo-1` and `CR-demo-2`, although production currently has zero change requests.

Impact: outages, RLS denials, and empty datasets can appear as credible operational data. This is a data-correctness and trust failure.

Required correction: return a typed `DataResult<T>` containing `data`, `source`, and `error`. Production must fail closed with a visible recoverable error. Demo data is allowed only behind an explicit development flag and only in the system-test area, always labelled `ข้อมูลตัวอย่าง`.

### P0-4: important writes and Timeline events are not atomic

Examples:

- Project creation commits the project before membership and Timeline; failures become warnings (`apps/web/app/actions/projects.ts:47-83`).
- Publish inserts a snapshot, then separately creates Timeline and lock, yet still returns success when either later write fails (`apps/web/app/actions/publish.ts:23-59`).
- Driver check-in/status writes and assignment status mutation are separate from Timeline (`apps/web/app/actions/driver.ts:21-53`, `:158-188`).
- Archive ignores Timeline failure (`apps/web/app/actions/projects.ts:100-110`).

Impact: the database can contain a business change without its immutable audit event, or a publish snapshot without a lock.

Required correction: add PostgreSQL transactional command functions/RPCs for significant commands. Each function must validate target ownership, mutate state, append Timeline, and return one result in one transaction. Do not edit applied migrations; add forward migrations beginning after the current latest migration.

### P0-5: publish is not enforced as a server-side state transition

`publishProjectAction` trusts caller-provided snapshot data, does not run the authoritative readiness query, does not update `projects.status`, and performs snapshot/Timeline/lock as independent operations. `assertPlanEditable` only checks `publish_locks`, not the canonical project state, and returns English copy (`apps/web/lib/domain/publish-locking.ts:5-41`).

Impact: direct API/server-action calls can publish an unready project, create inconsistent publish state, or leave the project editable.

Required correction: server loads the complete project aggregate, computes readiness, rejects blockers, snapshots canonical rows, changes project status, creates the lock and Timeline in one transaction. Every mission/assignment/call-sign/project-edit command must call the same edit-policy guard. Post-publish edits go through an approved change command.

### P1-1: project readiness uses sample operation days

`apps/web/app/(app)/project/page.tsx:69-73` loads live missions/assignments but obtains operation days from `demoKernel`. A real project can therefore show the wrong readiness and publish blockers.

Required correction: implement and use `getProjectDaysByProjectId`; never combine live and demo sources in one aggregate.

### P1-2: migration state is not reproducible

`npm run db:migrate:dry` reports that these applied files differ from their recorded checksums:

- `0011_driver_operations_rls.sql`
- `0018_seed_role_permissions.sql`
- `0019_rbac_rls_v2.sql`
- `0020_rbac_rls_v2_fixups.sql`

Several older applied migrations have no recorded checksum. Current-table presence is not proof that a clean database can be built from repository history.

Required correction: do not rewrite historical files again. Create forward repair migrations and add a disposable-database migration test that applies `0001 -> latest`, verifies constraints/RLS/grants/indexes, and then runs representative commands.

### P1-3: production smoke test gives false confidence

`scripts/production-smoke.mjs:24-27` accepts every `2xx` or `3xx`. During this audit, most protected routes returned `307` and were counted as PASS. Routes in the script also include legacy paths such as `/admin/*` and `/live-test`.

Required correction: replace it with an authenticated Playwright flow using a dedicated test user and isolated project prefix. Assert final URLs, page landmarks, API bodies, and database side effects. A redirect to login is success only for an explicit unauthenticated-access test.

### P1-4: legacy Vercel routing duplicates canonical Next.js routes

`vercel.json` uses legacy `builds`/`routes` and rewrites dynamic URLs to singular/query-string pages such as `/projects/:id -> /apps/web/project?projectId=...`.

Impact: access guards and canonical App Router behavior can diverge between local and production, and each new nested route requires manual routing rules.

Required correction: configure the Vercel project root as `apps/web`, use native App Router routes, retain only necessary headers/redirects, and remove route shims after redirect compatibility tests.

### P1-5: UI hierarchy is still form-first and overly long

Visual review at 390 px found:

- Project workspace is approximately 2,810 px tall and shows readiness, publish, mission creation, and change creation together.
- Mission Control is approximately 3,339 px tall; the empty map dominates the first viewport.
- Project tabs overflow or truncate on mobile.
- Assignment lanes retain a horizontal desktop model on a 390 px screen.
- The Call Sign selector and several controls truncate labels.
- Static scan found 12 uses of `text-[10px]`, 53 of `text-[11px]`, 41 of `text-[12px]`, 61 of `text-[13px]`, and extensive one-off rounded-card styling.

Required correction: make project overview summary-first; open create/edit flows in drawers or dedicated steps; use a table/list with segmented status filters below 1600 px instead of six horizontal lanes; collapse the empty map; establish 14 px as the minimum normal interface copy and 16 px for mobile form controls.

### P1-6: feedback and message state are inconsistent

Several components call `window.location.reload()` after actions, producing visible page flashes and lost context. Critical actions still use `window.confirm()`. Success/errors are local and inconsistent. Message resolution begins optimistically in `apps/web/components/mission-control/fleet-board.tsx:56-63`; failures are swallowed and the UI does not restore the unread state.

Required correction: provide a shared toast/live-region system, typed field/form errors, focus restoration, accessible confirmation dialog, `router.refresh()` or cache revalidation, optimistic rollback, and persisted read/resolved state with failure recovery.

### P1-7: hydration-risk patterns remain

Non-deterministic initial render values remain in `apps/web/components/projects/create-project-form.tsx:13-20` (`new Date()`/`Math.random()`) and time-dependent render paths exist in Mission Control and driver components. These match the previously reported hydration warning class.

Required correction: pass deterministic server-generated defaults, initialize client-only clocks after mount, and standardize Thai date/time formatting with an explicit `Asia/Bangkok` timezone snapshot.

### P2-1: scale is plausible but not proven for 50 vehicles and 250 jobs/day

The target volume is modest for PostgreSQL, but UI display caps are not database pagination. Mission Control polls multiple aggregate endpoints every 10 seconds, broad project queries can return all assignments, and no staging load test exists.

Required correction: add cursor/delta reads (`updated_after`, `since_id`), bounded Timeline/message windows, server query timing, indexes verified with `EXPLAIN (ANALYZE, BUFFERS)`, and a staging scenario with 50 vehicles, 50 drivers, and 250 assignments. The command center must remain usable without rendering all cards at once.

### P2-2: mobile source is outside the root quality gate

`apps/mobile-driver` exists, but the root workspaces do not include it, and root typecheck/lint/test/build do not validate the Expo app. Shared API-client modules still include unfinished contracts.

Required correction: add explicit mobile CI commands, `expo-doctor`, environment validation, iOS/Android preview builds, offline queue tests, and a real background-location device test. Do not claim screen-off GPS readiness until both platforms pass.

### P2-3: RLS intent and runtime mode need production proof

All inspected public tables have RLS enabled. Some tables have zero policies (`approvals`, `change_impacts`, `change_requests`, `permissions`, `publish_snapshots`, `role_permissions`, `roles`, `schema_migrations_tomp`, `user_role_assignments`). This may be intentional for service-only access, but the intent is not verified by a role matrix test. `TOMP_SCOPED_READS` is not surfaced in health output; an incorrect production value can make reads use privileged transport.

Required correction: add a policy inventory test for anonymous, authenticated member, non-member, project manager, driver session, and service role. Surface only a safe boolean `scopedReadsEnabled` in admin health. No secret values may be returned.

## 4. Required target user flows

The Agent must use these as the information architecture, not the current page structure.

### Operator

1. Login.
2. See only permitted projects.
3. Enter one project and retain project context.
4. Review readiness and blockers.
5. Create mission, Call Sign, driver, vehicle, and assignment without leaving the workflow.
6. Generate QR/PIN and receive an explicit success result.
7. Observe driver acknowledgement, readiness, GPS health, status, messages, and evidence in Mission Control.
8. Publish only when server readiness passes.
9. After publish, submit/approve/apply a change request instead of editing directly.
10. Review immutable Timeline.

### Driver

1. Open QR once.
2. Enter PIN and establish a scoped driver session.
3. Confirm identity, vehicle, evidence, consent, and readiness.
4. See current task and next task, with one primary action.
5. Start location sharing once; status must reflect actual browser/native location state.
6. Update trip status in allowed order.
7. Read/acknowledge new work and route changes.
8. Message the control center and see delivery/acknowledgement state.
9. Resume current state after refresh/reconnect.
10. Use the native preview app for verified background tracking; Web must clearly state foreground limitations.

## 5. Agent execution plan

Implement in this order. Each batch must be committed independently and must keep existing tests green.

### Batch A: close authorization boundaries (P0, first)

Primary files: `lib/auth/*`, all `app/actions/*`, `lib/api/driver-token.ts`, `app/api/driver/*`, `app/actions/driver-pin.ts`, token migrations.

Deliverables:

1. Remove every service-role permission bypass.
2. Add `ActorContext` and one mandatory authorization guard for operator commands.
3. Add QR/PIN exchange and a scoped driver session.
4. Reject raw QR tokens on operational endpoints after exchange.
5. Add atomic/rate-limited PIN attempts and revoke legacy no-PIN tokens.
6. Add CSRF/origin checks for cookie-authenticated driver writes and request-size/rate limits.

Done when: an unauthorized project member receives `403` even while the service-role key is configured; a raw QR token without PIN session cannot read or write driver operations; valid operator and driver sessions still work.

### Batch B: transactional command kernel and publish correctness (P0)

Primary files: projects/missions/assignments/publish/change/driver actions, `lib/timeline.ts`, `lib/domain/publish-*`, new forward migrations.

Deliverables:

1. Transactional database commands for create/update/cancel/publish/change/driver status.
2. Timeline insert is mandatory in the same transaction.
3. Authoritative server-side publish readiness.
4. Canonical project publish status and lock.
5. Consistent pre/post-publish edit policy.
6. Idempotency keys for retryable commands.

Done when: forced Timeline failure rolls back the business write; publish blocker leaves no snapshot/lock/status mutation; duplicate command retry creates no duplicate row/event.

### Batch C: live-data contract and database reproducibility (P0/P1)

Primary files: `lib/data/*`, project workspace, change-request components, migration runner/tests.

Deliverables:

1. Remove implicit demo fallback from production.
2. Remove hard-coded change requests and all other user-facing operational mocks.
3. Add typed source/error states.
4. Read real operation days.
5. Repair schema only through forward migrations.
6. Add clean-database and RLS matrix tests.

Done when: disconnecting Supabase shows a clear unavailable state and no fake project; an empty database shows an honest empty state; migration `0001 -> latest` succeeds on a disposable database.

### Batch D: workflow and information-architecture reset (P1)

Primary files: App Shell, project list/workspace, mission/assignment forms, dispatch board, Mission Control.

Deliverables:

1. Project-centric navigation with one system-test menu separated from operational menus.
2. Summary-first project workspace with progressive disclosure.
3. One guided assignment creation flow with inline prerequisites.
4. Responsive dispatch list/table plus optional board view.
5. Mission Control first viewport answers: what is active, what is late/stale, and what needs action.
6. Remove duplicate resource/live-operation panels.

Done when: a new operator can create project-to-QR without losing context; 390/768/1440 px views have no clipped controls or unintended horizontal page scroll.

### Batch E: interaction and visual-system consolidation (P1)

Primary files: `components/ui/*`, `globals.css`, forms, dialogs, navigation, all action surfaces.

Deliverables:

1. Standard Button/Input/Select/Dialog/Toast/Alert/Tooltip patterns.
2. Formal Thai copy and a user-facing English allow-list.
3. Minimum readable sizes and consistent density.
4. Loading, empty, success, warning, error, and offline states.
5. Keyboard/focus behavior and screen-reader labels.
6. Remove full-page reloads and native confirms.
7. Fix deterministic SSR/hydration inputs.

Done when: no action completes silently; every destructive action has an accessible confirmation and outcome; browser console has no hydration warning; automated accessibility scan has no critical violations.

### Batch F: Mission Control scale and data efficiency (P1/P2)

Primary files: Mission Control feed/API/data loaders, fleet/communication/timeline/map panels, indexes.

Deliverables:

1. Delta/cursor endpoints and bounded payloads.
2. Persisted unread/read/resolved communication state.
3. One shared freshness clock and one feed owner.
4. Compact empty map; list/map selection stays synchronized.
5. Server timing/observability and query plans.
6. Staging load scenario for 50 vehicles and 250 assignments.

Done when: warmed page/API p95 targets below are met and one driver's update appears in the command center without a full-page refresh.

### Batch G: mobile quality gate and background-location proof (P2)

Primary files: `apps/mobile-driver`, shared packages, CI, Expo configuration.

Deliverables:

1. Mobile typecheck/lint/test/Expo Doctor in CI.
2. Staging API environment with no service-role key in the bundle.
3. Secure driver-session storage and renewal.
4. Offline queue/retry visibility.
5. EAS internal preview builds for iOS and Android.
6. Physical-device test for foreground/background/locked-screen location and permission revocation.

Done when: both internal builds install, authenticate by QR/PIN, send GPS after screen lock within OS constraints, recover queued events, and can be remotely revoked.

### Batch H: real E2E, deployment, and operations evidence (P0/P1)

Primary files: Playwright tests, CI workflow, staging seed/cleanup, production smoke, runbooks.

Deliverables:

1. Authenticated operator E2E.
2. Driver QR/PIN/readiness/GPS/status/message E2E.
3. Publish/lock/change E2E.
4. RBAC negative matrix.
5. Deployment smoke with exact final URL assertions.
6. Logs, error tracking, release version, migration version, rollback procedure.

Done when: CI proves browser -> API/action -> database -> Timeline, and production smoke fails on unexpected redirects or data-side failure.

## 6. Mandatory verification matrix

| Scenario | Required assertion |
|---|---|
| Login | valid user reaches permitted projects; anonymous user cannot reach protected data |
| RBAC | each role's allowed command succeeds; each forbidden command returns `403`; service-role configuration changes neither result |
| Project | unique code validation, membership creation, and Timeline are one atomic result |
| Mission | real operation day is created/read; Timeline exists |
| Assignment | prerequisites, time conflicts, ordering, driver/vehicle ownership, and Timeline are verified |
| QR/PIN | raw token is stored only as hash; wrong PIN rate limits atomically; no-PIN API is rejected; revoke ends active session |
| Driver | readiness, photos, GPS, status sequence, issue, message, and refresh-resume persist |
| Mission Control | correct project/driver/vehicle attribution; stale/live/offline colors use server timestamps; unread persists until acknowledged |
| Publish | blockers prevent all writes; success creates status/snapshot/lock/Timeline atomically |
| Change | direct edit is blocked after publish; approved change applies once and records before/after |
| Failure mode | Supabase unavailable produces no demo substitution and offers a retry path |
| Responsive | 390, 768, 1024, 1440 px; 200% text zoom; no overlap, clipping, or page-level horizontal scroll |
| Capacity | 50 vehicles, 50 drivers, 250 assignments, 10,000 GPS pings; UI remains bounded and queries use intended indexes |
| Mobile | iOS and Android physical-device background tracking, offline queue, permission revoke, session revoke |

## 7. Performance and reliability budgets

Use staging measurements, not local cold compilation:

- Warmed server-rendered operational page p95: `< 1.5 s`.
- Read API p95: `< 600 ms`; write command p95: `< 2 s`.
- Visual response to click/tap: `< 150 ms`; always show pending state for network work.
- Mission Control change visibility: `< 10 s` while polling; target `< 3 s` when Realtime signal is enabled.
- GPS classification: live `<= 35 s`, slow `36-120 s`, stale/offline `> 120 s`, using one shared rule.
- Maximum initial command-center payload: define and enforce a measured budget; do not return unbounded history.
- Zero silent Timeline failures and zero business-state partial commits.
- Zero critical accessibility findings and zero hydration errors in the E2E console.

## 8. Constraints for the implementing Agent

- Do not add AI, route optimization, accounting, CRM, payroll, fleet maintenance, or unrelated role portals.
- Do not use mock success, implicit demo fallback, or hard-coded operational rows in production UI.
- Do not expose a Supabase secret/service-role key to Web or mobile clients.
- Do not mutate or delete Timeline events.
- Do not edit already-applied migration files; use forward migrations.
- Do not weaken auth/RLS to make tests pass.
- Do not call a redirect-only route smoke test an E2E test.
- Preserve Web foreground-GPS limitations in copy until native-device proof exists.
- Keep the current production environment intact; use an isolated staging project/database for destructive and load tests.

## 9. Recommended ownership split

| Workstream | Owner profile | Can run in parallel after |
|---|---|---|
| A. Operator/driver security | senior backend/security | immediately |
| B. Transactional commands | database/backend | A actor/session contract agreed |
| C. Live-data/migrations | database/QA | immediately; coordinate with B |
| D. IA/workflow | product frontend | C data-result contract agreed |
| E. UI/accessibility | design-system frontend | D route/page structure agreed |
| F. Mission Control performance | full-stack/performance | B and C command/read contracts stable |
| G. Mobile proof | React Native/mobile | A driver-session contract stable |
| H. E2E/release evidence | QA/platform | starts in A and expands after every batch |

## 10. Final release gate

The internal pilot may be declared ready only when every P0 is closed, the authenticated E2E suite passes twice against a clean staging seed, the 50-vehicle/250-assignment scenario meets the budgets, iOS and Android location behavior is documented from real devices, and a human Thai-language visual review passes the mandatory viewport matrix. Build success by itself is not a release gate.
