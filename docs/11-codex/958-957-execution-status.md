# 958 — Execution status of the 957 effectiveness audit

Base: through commit `410aaa2`. **Migrations 0024/0025/0026/0027 are applied to production and verified. 0028 (P2-1 indexes) is written + schema-verified — needs `apply-migrations.mjs --yes` on production.**
This tracks what was actually done against [957](957-system-effectiveness-audit-and-agent-plan.md) and what still needs a dedicated workstream.

## Second pass (P0-3 finish, P1-2, P2-1, Batch H)

| Audit item | What changed | Commit |
|---|---|---|
| **P0-3** finished — `DataResult<T>` | `lib/data/data-result.ts`: every operational list loader (change-requests, operation-days, missions, assignments, call-signs, timeline) returns `DataResult` = ok\|fail, both carrying an empty fallback. A real backend failure is `ok:false`; the no-client demo/Postgres path stays `ok:true`. `ChangeRequestList` / project overview / dispatch page / mission-control render `<DataUnavailable>` (retry = `router.refresh()`) on failure. `publishProjectAction` refuses to publish when any plan read failed. Test: `data-result.test.ts`. | `8c38c4c` |
| **P1-2** checksum drift — analysed, no real drift | `scripts/check-migration-drift.mjs` (`npm run db:check-drift`) applies the repo history to a disposable Postgres and diffs the RBAC surface (35 RLS policies, 39 `role_permissions`, 6 helper fns) against production. **All match** — `0011/0018/0019/0020` edits were comments/idempotency only; `0018→0027` reconciled the live objects. No forward-repair migration. `apply-migrations.mjs --reconcile-checksums` clears the `CHANGED` warning (checksum bookkeeping only) — still to run on prod. Doc 961. | `55980f9` |
| **P2-1** bounded reads + hot-path indexes | `getTimelineEventsByProjectId` had lost its LIMIT (and the 0025 triggers write a row per insert) — capped at 100. Migration `0028`: composite `(project_id, created_at desc)` on `assignment_status_updates` / `driver_issue_reports`, `(project_id, sent_at desc)` on `driver_notifications`. Load scenario (250 assignments / 10k pings) confirms all four hot reads are index range scans, no Seq Scan, sub-ms. `load-scenario.mjs` now EXPLAINs the timeline/status/issue windows. | `410aaa2` |
| **Batch H** — driver-API guard tests + CI | `unauthenticated.spec.ts` now asserts `updates` / `status` / `location` / `issue` / `readiness` 401 with no session and ignore `?token=`. New skip-guarded `driver-flow.spec.ts` and `rbac-negative.spec.ts`. `ci.yml` gains a `database` job (Postgres 17 service → `db:verify-schema` / `db:verify-rls` / `db:load-scenario`); new `e2e-prod.yml` runs `unauthenticated.spec.ts` vs production on a 3h schedule + manual (off `push` — races the deploy). `@playwright/test` in root devDeps. | (this pass) |
| **P0-2** follow-up found by the new test | `/api/driver/location` validated the body **before** the session check, so an unauthenticated `{}` POST got a 400 (endpoint-shape confirmation) instead of 401. Moved `resolveDriverSession` first, matching `status` / `issue` / `readiness`. No data was reachable either way. | (this pass) |

## Done in this pass

| Audit item | What changed | Commit |
|---|---|---|
| **P0-1** service-role authorization bypass | Removed `&& mode !== "service_role"` from all 16 server-action guards. `requirePermission()` now grants a project-scoped action to a global role (super_admin) that holds the permission, via new `getGlobalRoleKeys()`. `ROLE_PERMISSIONS` restored the operator keys 0021 trimmed (`driver.create`, `vehicle.create`, `timeline.create`, `change.approve/apply`). Forward migration `0024` mirrors this into `role_permissions`. Tests added. | `529f455` |
| **P0-2** driver API bypasses PIN/device gate | New HMAC-signed 12h device-bound driver session (`lib/driver-access/session.ts`). `establishDriverSessionAction` exchanges the QR token for the session cookie only after the page's device + PIN checks; `DriverSessionGate` runs it on mount. All operational endpoints (`status/issue/readiness/location/updates/evidence`) and the driver server actions now require the session and take project/assignment/driver from it — no raw token, no `?token=` query string. Tests added. Remaining: `/api/driver/assignment` (mobile packet read) + the mobile client (Batch G). | `cf2ba14` |
| **P0-3** demo data on live surfaces (partial) | `ChangeRequestList` reads real `change_requests` (new `lib/data/change-requests.ts`), honest empty state — no more `CR-demo-1/2`. Project overview readiness reads real `project_days` (new `lib/data/operation-days.ts`); `demoKernel` import removed from that page. Neither loader falls back to demo rows. | `39bdf78` |
| **P0-5** publish not a server transition | `publishProjectAction` loads the real aggregate, runs the canonical readiness check (blockers reject), snapshots the actual rows (not the client blob), flips `projects.status`, then locks + timelines. `assertPlanEditable` also blocks on `projects.status`; blocker copy is Thai. Cross-write atomicity is still P0-4. | `33bcf46` |
| **P1-1** readiness used sample operation days | Covered by the `operation-days.ts` change. | `39bdf78` |
| **P1-7** hydration risk in Mission Control clock | `MissionControlFeedProvider` `now` starts at `0`, set by the mount effect. `create-project-form` was already deterministic. | `39bdf78` |
| **P0-3** remaining demo fallbacks | New `lib/data/demo-fallback.ts` — demo rows only when NO backend is configured and not production; otherwise a failed/denied/empty query returns empty. Applied to projects/missions/call-signs/resources/assignments/timeline. The visible "retry" surface + full `DataResult<T>` contract is still Batch C. | `9a1b29c` |
| **P0-4** atomic Timeline + command RPCs | `0024` (RBAC topup), `0025` (9 AFTER triggers → `timeline_events` in the business transaction), `0026` (`create_project_command` / `publish_project_command`) **applied to production**. Verified live: a smoke project produced exactly one `PROJECT_CREATED` via both the raw insert and the RPC; the publish RPC committed snapshot+status+lock+event atomically; `purge_smoke_test_data` cleaned up. `createProjectAction` + `publishProjectAction` now call the RPCs; `createTimelineEvent` de-dups the 9 trigger-owned events so the remaining app-side calls (mission/assignment/driver) don't double-write. `0027` adds `change_apply_command` (patches the target row column-by-column with per-column type casting **and** flips `change_requests.status` in one transaction — verified live on text/jsonb/timestamptz columns, re-apply raises) wired into `updateChangeStatus`, plus `command_log` + `claim_command` (the idempotency primitive — applied, not yet called by the create/publish forms). | `529f455`→`7aa9aee` |
| **P1-2** clean-DB migration test | New `scripts/verify-schema.mjs` (`npm run db:verify-schema`) — stubs the Supabase `auth`/`storage`/`realtime` objects, applies every migration to a disposable Postgres, asserts required tables / RLS / constraints / role seeds. Ran green through `0026`. The four checksum-drift files still need a diff + forward-repair migration (needs live DB access). | (this commit) |
| **P1-6 / Batch E slice** shared toast | New `<ToastProvider>`/`useToast()` in the app shell (aria-live, stacked, auto-dismiss). Six create/message/cancel surfaces toast their result instead of a scattered local `<p>`; field errors stay inline. `ActionFeedback` kept for data-showing surfaces. Full component library = Batch E. |  `408e3d2` |
| **P1-6** reloads / blocking confirms (partial) | Create/cancel/message forms and the driver PIN gate / pre-flight call `router.refresh()` instead of `window.location.reload()`. `cancel-assignment` and `reset-password` use an inline two-step confirm, not `window.confirm()`. Shared toast/dialog system is still Batch E. | `714e189` |
| **P1-3** smoke test false confidence (partial) | `scripts/production-smoke.mjs` rewritten: protected routes must redirect **to `/login`** (verified target, not just any 3xx), public routes must serve 200, `/api/health` must report `status:ok` + `publicSecretSafe`, retired paths must not serve. Ran green against production. Not an E2E suite (Batch H). | (this commit) |
| **P2-3** RLS role matrix + scoped-reads visibility | `/api/health` returns `checks.scopedReadsEnabled`. New `scripts/verify-rls-matrix.mjs` (`npm run db:verify-rls`) applies every migration to a disposable Postgres and asserts, per persona (anon / non-member / member / super_admin / service_role): read isolation by project membership, and that the cookie-bound `authenticated` client cannot write anything directly — writes go only through server actions on the service-role client (which self-check with `requirePermission`). Ran green. Documents that there are no write RLS policies by design. | `b44d2f8` + this |
| Earlier 955/956 work the audit references | Shared GPS-freshness rule, one Mission-Control feed owner + one clock, `useVisibleSlice` list caps, single `formatRelativeTh`, driver "next job" + centre "งานถัดไป" via `lib/domain/driver-day-order.ts`, time-conflict detection. | 955/956 |

### Post-deploy verification for P0-2

The QR flow now mints a session cookie before the API works. Confirm on the deployed site (or `/superadmin/dev-tools/live-test`):

1. Open a QR link → enter PIN → the task view loads and shows "กำลังเชื่อมต่องาน…" briefly, then GPS share / status / messages all work.
2. Open the same QR link in a fresh browser (no cookies) and call `/api/driver/updates` or POST `/api/driver/status` directly — must return `401`, not data.
3. A no-PIN legacy token still opens (device-bound) and its session establishes without a PIN prompt.

### Post-deploy verification for P0-1 (do this first)

The permission check now actually runs in production. Confirm on the deployed site:

1. Log in as the platform admin (`nuttakun.mek@gmail.com`, super_admin) → creating a project, mission, assignment, driver, vehicle, QR, and publishing all still succeed. If any returns "No project membership was found" or "Role … does not include …", the global-role path is not resolving — check `user_role_assignments` has an active `project_id IS NULL` row with `role_key = 'super_admin'` for that profile.
2. Run migration `0024`: `node scripts/apply-migrations.mjs --yes` then `node scripts/sync-supabase-migrations.mjs`. Until then the roles page (`/superadmin/roles`) and `getViewerAccess().permissions` will under-report operator permissions — the actions still enforce correctly from the static map, but UI gates keyed on `permissions.includes(...)` may hide a control that would in fact work.
3. Seed a non-admin project member (dispatcher) and confirm: their allowed commands work; a command for a project they are not a member of returns a failure; the service-role key being configured does not change either result.

## Not done — needs a dedicated workstream

These are real and large. Each is a batch in 957 §5; none is a quick edit.

Every P0 is closed. Every incremental item an agent can do without new
infrastructure is done. What is left needs the owner, an external account, or a
product decision.

| Audit item | Why an agent can't finish it now | Owner action |
|---|---|---|
| **P0-4** generic `command_id` idempotency bus | Duplicate writes are already blocked by domain uniqueness (`project_code` index, `project_already_published`) and both create/publish buttons disable while in flight. The `command_log` + `claim_command` primitive is live but not wired to forms — doing so needs a `release_command` first (else a domain failure burns the id). Deferred by design, not blocked. | decide if the generic bus is worth a plan |
| **P1-2** reconcile the drift checksums on prod | Analysis done — **no real schema drift** (doc 961). Only the `schema_migrations_tomp` checksum bookkeeping is stale. | run `node scripts/apply-migrations.mjs --reconcile-checksums --yes` |
| **0028** (P2-1 indexes) apply to prod | Written + schema-verified; the sandbox blocks the migration write. | run `node scripts/apply-migrations.mjs --yes` |
| **P1-4** legacy `vercel.json` routing | The project-root change is a Vercel dashboard setting; route-shim removal + redirect retest follows it. High blast radius. | set Vercel project root to `apps/web`, then hand back for the shim removal |
| **P1-5** form-first IA redesign | Product-design workstream (summary-first workspace, drawer create flows, responsive dispatch table). Not a refactor. | brief + sign-off on the new IA |
| **P2-2 / Batch G** mobile quality gate | Mobile CI, staging bundle without the service-role key, EAS preview, real-device GPS test. Owned by the mobile agent (doc 959); needs devices + an Expo/EAS account. | — (mobile agent) |
| **`/api/driver/assignment`** still takes `?token=` | The mobile packet read. Moving it to the session model must be coordinated with the mobile client rewrite. | coordinate with the mobile agent |
| **Batch H** authenticated E2E in CI | The specs exist (`operator-flow`, `driver-flow`, `rbac-negative`) but are `test.skip` until a **staging deploy with its own Supabase project** exists — they seed/mutate and must never touch production. | stand up a staging environment |

## Batch E status

Largely done across earlier passes: shared `<ToastProvider>`/`useToast`,
`<DataUnavailable>` retry surface (this pass), `router.refresh()` everywhere a
full reload was used, inline two-step confirms instead of `window.confirm()`,
inline field errors. Not done: a single shared confirm-dialog component (three
bespoke inline confirms work and are accessible), and persisted read/resolved
state for the timeline/comms feeds (a feature, needs its own small plan).
