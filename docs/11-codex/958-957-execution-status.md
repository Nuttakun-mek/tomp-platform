# 958 — Execution status of the 957 effectiveness audit

Base: through commit `8a324f1`. **Migrations 0024/0025/0026 are applied to production and verified.**
This tracks what was actually done against [957](957-system-effectiveness-audit-and-agent-plan.md) and what still needs a dedicated workstream.

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
| **P0-4** atomic Timeline + command RPCs | `0024` (RBAC topup), `0025` (9 AFTER triggers → `timeline_events` in the business transaction), `0026` (`create_project_command` / `publish_project_command`) **applied to production**. Verified live: a smoke project produced exactly one `PROJECT_CREATED` via both the raw insert and the RPC; the publish RPC committed snapshot+status+lock+event atomically; `purge_smoke_test_data` cleaned up. `createProjectAction` + `publishProjectAction` now call the RPCs; `createTimelineEvent` de-dups the 9 trigger-owned events so the remaining app-side calls (mission/assignment/driver) don't double-write. `change_apply` full RPC + idempotency keys still open (960 step 3). | `529f455`→`8a324f1` |
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

| Audit item | Why it is out of scope for an incremental pass |
|---|---|
| **P0-4** remaining: `change_apply` RPC + idempotency keys | The 8 create/status commands are atomic (triggers + the two RPCs, live). `change_apply` still patches its target and flips `change_requests.status` in two statements (target-first now, so a failure is retryable). A generic `change_apply_command` (dynamic jsonb patch over the target table) + client-supplied `command_id` idempotency keys are unwritten. |
| **P1-2** migration checksum drift (`0011,0018,0019,0020`) | The clean-DB harness exists (`npm run db:verify-schema`). Still need: diff the 4 applied files against the repo on the live DB and write forward-repair migrations. Needs live DB access. |
| **Batch H** E2E scaffold | `e2e/` — `playwright.config.ts`, `unauthenticated.spec.ts` (runs today: anon→/login, health honesty, driver no-token notice), `operator-flow.spec.ts` (login→project→mission→dispatch, `test.skip` until `E2E_OPERATOR_EMAIL/PASSWORD` set), README with the run + remaining steps. `npm run e2e`. Not in CI; needs `npm i -D @playwright/test`. Driver-flow / publish-flow / RBAC-negative specs + the CI job still to write. |
| **P1-4** legacy `vercel.json` routing | Set the Vercel project root to `apps/web`, drop `builds`/`routes`, use native App Router. **This is a Vercel dashboard change the owner must make**, plus removing every route shim after redirect tests. High blast radius. 957 Batch H / §1-4. |
| **P1-5** form-first, over-long IA | Summary-first workspace, drawer-based create flows, responsive dispatch list/table, compact Mission Control first viewport. 957 Batch D — a product-design workstream, not a refactor. |
| **P1-6** inconsistent feedback / `window.location.reload()` / `window.confirm()` | Shared toast/live-region, typed form errors, accessible confirm dialog, optimistic rollback, `router.refresh()` instead of full reload, persisted read/resolved state. 957 Batch E. |
| **P2-1** scale not proven (50 vehicles / 250 jobs / 10k pings) | Delta/cursor reads, bounded payloads, `EXPLAIN (ANALYZE)` on the hot queries, a staging load scenario. UI caps (`useVisibleSlice`) are done; DB pagination + load proof are not. 957 Batch F. |
| **P2-2** mobile outside the quality gate | Mobile CI (`expo-doctor`, typecheck/lint/test), staging env with no service-role key in the bundle, EAS preview builds, real-device background-GPS test. 957 Batch G — needs devices and an Expo/EAS account. |
| **Batch H** authenticated E2E | No browser→API→DB→Timeline suite exists. Everything above needs this to be considered "done" per the 957 release gate. |

## Recommendation

Both critical security holes (P0-1 auth bypass, P0-2 driver token) and P0-5 (publish correctness) are closed. The safe next increments a single agent can take without new infrastructure:

1. **P0-3 `DataResult<T>`** — mechanical once the contract is set; do it one data module at a time behind the existing `resolveReadClient` boundary, then a visible "ข้อมูลไม่พร้อมใช้งาน / ลองใหม่" surface on the pages.
2. **P1-2 clean-DB migration test** — a script (`0001 → latest` on a disposable DB + constraint/RLS assertions), not a redesign. Also repairs the four checksum-drifted files via forward migrations.
3. **P0-4 transactional kernel** — needs a DB owner and forward migrations; scope it as its own plan.

The rest (Batches D, E, F, G, H, vercel.json) each need either a design decision from the owner, external accounts/devices, or a multi-file coordinated change that should be its own plan document.
