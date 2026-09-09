# 962 — Web-side review before the real-device flow test

**For:** the mobile-app agent (doc 959) and the owner.
**When:** after the `driver_mobile_sessions` merge (`44e8ad9`), before testing
QR → session → mobile shell → GPS → Mission Control on a real device.

Reviewed the whole web app for compatibility with the mobile-session work and
for bugs. `main` is `ccaba0b`+ (this pass adds a few commits). Production deploy
`2026.09.09.2321` already carries the mobile-session code.

---

## Compatibility: web ↔ mobile-session merge — OK

The mobile shell integration is **entirely behind `window.TOMP_MOBILE_SHELL`
feature detection**. In a normal browser every shell branch is skipped:

- `driver-session-gate.tsx` — `establishMobileSessionIfNeeded()` returns early
  when there is no shell. My `router.refresh()` / retry-callback refactor and
  the mobile agent's challenge handshake merged cleanly.
- `driver-location-share.tsx` — `getMobileShell()` returns null → falls through
  to the existing `navigator.geolocation` path unchanged. The
  `tomp:native-status` listener is inert in a browser.
- `driver-token.ts` — web calls carry the `dsess` **cookie** (unchanged path).
  Only `x-driver-session` **header** calls (native) get the extra
  `markMobileSessionUsed()` check.

**Verified:** typecheck / lint / test (90 + 14) / build green on merged main;
`e2e/unauthenticated.spec.ts` 15/15 against production; every `/api/driver/*`
endpoint (incl. `mobile-session/challenge` → 401, `mobile-session/exchange` →
400) still rejects an unauthenticated caller.

---

## Fixed this pass

| # | Where | Issue | Fix |
|---|---|---|---|
| 1 | `scripts/verify-rls-matrix.mjs` | `service_role` was created without `BYPASSRLS` when the role already existed from an earlier script on the same DB (the new CI `database` job runs verify-schema, verify-rls, load-scenario against one Postgres). RLS matrix failed: "service_role sees 0, want 2". | `alter role service_role with bypassrls` unconditionally. |
| 2 | `database/migrations/0030` | `0029` created `driver_mobile_sessions` with RLS + a revoke but **no explicit `grant … to service_role`**. Production has it via Supabase default grants (checked live: `has_table_privilege` true), but the disposable-DB verify scripts and any future Supabase default-privilege change would break. | `0030_driver_mobile_sessions_grants.sql` — explicit grant, matches the 0011 / 0012 / 0027 pattern. Idempotent, no-op on prod. |
| 3 | `driver-session-gate.tsx` | `await establishMobileSessionIfNeeded()` had no catch. If the challenge `fetch` throws (offline at that instant, inside the shell), `establish()` rejects and `setState("ready")` never runs → the driver is stuck on the "กำลังเชื่อมต่องาน…" spinner. | `.catch(() => undefined)` — best-effort, never blocks the task view. |
| 4 | migration hygiene (`ccaba0b`, prior) | Two `0027_*` in `supabase/migrations/` after the merge; `20260909100835_…` filename off-convention. | Renamed to `0029_…`; `npm run db:check-mirror` in CI now fails on a stale mirror; `apply-migrations.mjs --rename-applied`. |

---

## Follow-up applied on 2026-09-10

The three mobile-session concerns below were fixed before real-device testing:

| Where | Fix |
|---|---|
| `mobile-session.ts` `markMobileSessionUsed()` | Now returns `active` / `inactive` / `unknown`, throttles `last_used_at` touches to 120 seconds, and catches Postgres-path DB errors. A transient DB error no longer forces a 401 after the signed driver session has already been verified. Expired, revoked, or missing mobile sessions still return 401. |
| `mobile-session.ts` `exchangeMobileSessionChallenge()` | The activation update now also requires `status = 'challenge_issued'` and returns `null` when a replay loses the race, preventing the same challenge from minting a second usable mobile session. |
| `driver-session-gate.tsx` `establishMobileSessionIfNeeded()` | The mobile-shell challenge fetch now retries once after 150 ms when the first response is 401, covering the device timing window where the browser has not applied the driver-session cookie yet. |

Production migration `0030_driver_mobile_sessions_grants.sql` was applied and a follow-up dry run reported `Nothing to apply. Database is up to date.`

Verification:

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed: web 90/90 and driver-core 14/14.
- `npm run test --prefix apps/mobile-driver` passed: 14/14.
- `$env:NEXT_TELEMETRY_DISABLED='1'; npm.cmd run build` passed.

---

## Original mobile-agent watch items — fixed in follow-up

These were the original watch items from the review. They are retained for audit context; see the 2026-09-10 follow-up above for the applied fixes.

| Where | Issue | Suggested direction |
|---|---|---|
| `mobile-session.ts` `markMobileSessionUsed()` | Runs an `UPDATE` (`last_used_at`) on **every** native `/api/driver/*` call. Under background GPS polling that is a steady write per active driver. And on a **transient DB error it returns `false` → the caller 401s** even though the session is valid — a DB blip logs out every mobile driver mid-operation. The Postgres fallback path has no try/catch → a throw becomes a 500. | Throttle the touch (only if `last_used_at` older than N min). Distinguish "row not found / expired / revoked" (→ 401) from "DB error" (→ proceed, session already verified by signature). Wrap the Postgres path. |
| `mobile-session.ts` `exchangeMobileSessionChallenge()` | Between the `select` of the `challenge_issued` row and the `update` to `active`, a replayed exchange with the same code can mint twice — the `update` guards only on `id`, not `status = 'challenge_issued'`. Low severity (single-use code, 60 s TTL, raw code required) but not airtight. | Add `and status = 'challenge_issued'` to the update's `WHERE`; treat 0 rows updated as "already used". |
| `driver-session-gate.tsx` `establishMobileSessionIfNeeded()` | Calls `fetch("/api/driver/mobile-session/challenge")` immediately after the `establishDriverSessionAction` server action returns. Relies on the browser having applied the `Set-Cookie` from the action before this fetch. Usually fine in Next 15; worth confirming on-device. | If it 401s on device, retry once after a tick, or have the action return a one-time challenge directly. |

---

## NOT a bug (noted so nobody re-investigates)

- `load-scenario.mjs` prints `⚠ sequential scan` for "latest GPS per assignment".
  That `distinct on (assignment_id)` query is **synthetic — the app never runs
  it** (Mission Control fetches `… order by recorded_at desc limit 50` and
  dedupes in JS, served by `gps_locations_project_recorded_idx`). The load
  scenario uses one project so `project_id` isn't selective and the planner
  Seq-Scans 10 k rows. No index needed. The other three windows
  (timeline / status / issues) are index range scans after `0028`.

---

## Pending — owner / infra (not code)

1. Done on 2026-09-10: `--rename-applied` repointed the prod tracking row to
   `0029_driver_mobile_sessions.sql`.
2. Done on 2026-09-10: `node scripts/apply-migrations.mjs --yes` applied
   `0030_driver_mobile_sessions_grants.sql` to production.
3. Done on 2026-09-10: `--reconcile-checksums --yes` cleared the
   `0011/0018/0019/0020` CHANGED flags after drift verification.
4. Still pending: P1-4 `vercel.json` → project-root migration (doc 958).
   Independent of mobile.

---

## Ready for the next step?

**Web side: yes.** QR → PIN → `dsess` cookie → `/api/driver/*` → GPS write →
Mission Control all work in a browser today and are covered by tests. The
mobile-session challenge/exchange endpoints are live and correctly gated.

**Blocked on a device:** the mobile shell handshake (`TOMP_MOBILE_SHELL`
postMessage, `tomp:native-status` events, background GPS) can only be exercised
from the Expo app. When testing on-device, watch for issue #1 above (session
touch failing closed) and #3 (cookie timing).
