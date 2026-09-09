# 958 — Execution status of the 957 effectiveness audit

Base: through commit `33bcf46`.
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
| **P2-3** surface scoped-reads state (partial) | `/api/health` now returns `checks.scopedReadsEnabled` — a safe boolean. | `b44d2f8` |
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
| **P0-3** remaining demo fallbacks | `lib/data/{projects,missions,call-signs,resources,assignments,timeline}.ts` still return `demoKernel` on failure/empty. Removing this means a `DataResult<T>` (`data` / `source` / `error`) contract that ripples to every consumer page + a visible "unavailable, retry" surface. That is 957 Batch C and is a coordinated refactor, not a patch. |
| **P0-4** non-atomic writes | Needs PostgreSQL transactional command functions (RPCs) so business write + Timeline (+ lock) commit or roll back together, for create/update/cancel/publish/change/driver-status. 957 Batch B — forward migrations + a disposable-DB migration test + rewiring every write action to the RPC. Do it as one batch with a DB owner; a partial version leaves some paths atomic and some not, which is worse for reasoning. P0-5 (publish correctness) is done; its atomicity folds into this batch. |
| **P1-2** migration checksum drift (`0011,0018,0019,0020`) | Forward repair migrations + a clean-DB `0001→latest` test harness. Do not rewrite history. 957 Batch C item 5–6. |
| **P1-3** smoke test treats 307 as pass | Replace `scripts/production-smoke.mjs` with an authenticated Playwright flow asserting final URLs, page landmarks, API bodies, DB side effects. Needs Playwright + a dedicated test user + isolated project prefix + CI wiring. 957 Batch H. |
| **P1-4** legacy `vercel.json` routing | Set the Vercel project root to `apps/web`, drop `builds`/`routes`, use native App Router. **This is a Vercel dashboard change the owner must make**, plus removing every route shim after redirect tests. High blast radius. 957 Batch H / §1-4. |
| **P1-5** form-first, over-long IA | Summary-first workspace, drawer-based create flows, responsive dispatch list/table, compact Mission Control first viewport. 957 Batch D — a product-design workstream, not a refactor. |
| **P1-6** inconsistent feedback / `window.location.reload()` / `window.confirm()` | Shared toast/live-region, typed form errors, accessible confirm dialog, optimistic rollback, `router.refresh()` instead of full reload, persisted read/resolved state. 957 Batch E. |
| **P2-1** scale not proven (50 vehicles / 250 jobs / 10k pings) | Delta/cursor reads, bounded payloads, `EXPLAIN (ANALYZE)` on the hot queries, a staging load scenario. UI caps (`useVisibleSlice`) are done; DB pagination + load proof are not. 957 Batch F. |
| **P2-2** mobile outside the quality gate | Mobile CI (`expo-doctor`, typecheck/lint/test), staging env with no service-role key in the bundle, EAS preview builds, real-device background-GPS test. 957 Batch G — needs devices and an Expo/EAS account. |
| **P2-3** RLS role-matrix proof | A policy-inventory test across anon / member / non-member / PM / driver session / service role. 957 Batch H item 4. |
| **Batch H** authenticated E2E | No browser→API→DB→Timeline suite exists. Everything above needs this to be considered "done" per the 957 release gate. |

## Recommendation

Both critical security holes (P0-1 auth bypass, P0-2 driver token) and P0-5 (publish correctness) are closed. The safe next increments a single agent can take without new infrastructure:

1. **P0-3 `DataResult<T>`** — mechanical once the contract is set; do it one data module at a time behind the existing `resolveReadClient` boundary, then a visible "ข้อมูลไม่พร้อมใช้งาน / ลองใหม่" surface on the pages.
2. **P1-2 clean-DB migration test** — a script (`0001 → latest` on a disposable DB + constraint/RLS assertions), not a redesign. Also repairs the four checksum-drifted files via forward migrations.
3. **P0-4 transactional kernel** — needs a DB owner and forward migrations; scope it as its own plan.

The rest (Batches D, E, F, G, H, vercel.json) each need either a design decision from the owner, external accounts/devices, or a multi-file coordinated change that should be its own plan document.
