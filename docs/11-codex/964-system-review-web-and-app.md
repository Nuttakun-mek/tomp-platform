# 964 — System review: web ↔ app compatibility, contracts, correctness, performance

Reviewed at `6990b56` (after `/api/driver/assignment` was closed to session-only).
Covers the whole communication surface: web API routes, the shared packages, the
WebView↔native bridge, the mobile services, and the hot read paths.

Baseline before this pass: web 90 tests, driver-core 14, mobile 14 — all green.

Update 2026-09-10: the mobile code items below were patched on `main` after this
review. Mobile tests now cover the session assignment API contract.

---

## Verdict

The **web side is sound**. The **web↔app contract now has a shared source of
truth**, and the severe mobile offline-loss issues have been patched. The next
risk is not code shape; it is real-device verification under weak network,
backgrounding, and OS permission states.

## Fixed after this review (mobile)

### P0 — offline queue now has flush triggers

`App.tsx` now calls `flushOfflineQueue()` when:

- the mobile session is established
- the app starts
- the app returns to foreground
- the shell is active every 30 seconds

The shell also shows a small pending-count indicator when rows remain in the
outbox.

`flushOfflineQueue()` also has an in-flight promise guard. If app foreground,
session setup, and the 30-second interval trigger at the same time, later calls
reuse the active flush instead of reading and replaying the same 100 rows again.

### P0 — background location failures are queued

The `TaskManager` background GPS task now routes failed sends through the same
`submitOrQueueLocation()` path as foreground GPS. A dead zone should no longer
silently drop the ping without retry.

### P1 — safer bridge payload embedding

`postStatusToWeb()` no longer double-escapes JSON backslashes. It uses the
standard safe embeds for `<`, U+2028, and U+2029 before injecting the custom
event into the WebView.

### P1 — mobile HTTP timeout and response normalization

`driver-api.ts` and `mobile-session-api.ts` now use a 10-second abort timeout and
normalise non-2xx JSON responses into `{ success:false, statusCode }`.

### P1 — poison rows are evicted

`flushOfflineQueue()` treats 401/403 as terminal and drops rows after five failed
attempts, so an expired mobile session cannot block newer location pings
forever.

Background GPS now passes the already-read mobile session into the send path, so
each ping does not read SecureStore twice.

### P1 — queue sync status no longer overwrites the main shell message

Outbox sync feedback is stored in a separate `syncLabel`, so it does not replace
the current QR/session/GPS status message while the driver is opening or using a
job.

### P2 — bridge contract re-exported from `@tomp/driver-core`

`apps/mobile-driver/src/bridge/protocol.ts` now re-exports the shared bridge
constants, types, parser, and status builder. `App.tsx` injects
`BRIDGE_NAMESPACE` / `BRIDGE_VERSION` from the same source.

### P2 — offline replay supports all queued driver action kinds

`sendAction()` can now replay `readiness`, `status`, `issue`, and `location`
through the session-authenticated driver API routes. This keeps future queued
readiness/status/message rows from becoming permanent poison rows.

### P2 — phantom `@tomp/api-client` dependency removed from mobile shell

`apps/mobile-driver` now imports the shared bridge through `@tomp/driver-core`
but no longer declares `@tomp/api-client` until that package becomes the real
mobile transport layer. The current mobile shell keeps its own small HTTP layer
because it needs React Native timeout/error semantics and the live location
endpoint is not exposed by `@tomp/api-client` yet.

---

## Fixed in this pass (web / shared packages)

### 1. The bridge contract was declared three times, with no shared type

`BRIDGE_NAMESPACE` / `BRIDGE_VERSION` / `NativeStatus` existed in
`apps/mobile-driver/src/bridge/protocol.ts`, but:

- `apps/web/components/driver/driver-session-gate.tsx` hand-declared
  `MobileShellWindow` with `namespace: "tomp.driver"; version: 1`
- `apps/web/components/driver/driver-location-share.tsx` hand-declared a
  *different* shape (`TompMobileShell`) plus a `declare global` on `Window`
- both hardcoded the event name `"tomp:native-status"` and the `NativeStatus`
  string values

Bumping `BRIDGE_VERSION` on the mobile side would have silently stopped matching
the web's hardcoded `version === 1` checks — the shell integration would go dark
with **no type error and no test failure**.

**Fix:** new `packages/driver-core/src/bridge.ts` — the single source both sides
import. DOM-free and dependency-free so React Native can use it (anything needing
a `window` takes it as a parameter). Exports `BRIDGE_NAMESPACE`,
`BRIDGE_VERSION`, `BridgeMessage`, `BridgePayloadMap`, `NativeStatus`,
`NativeStatusMessage`, `MobileShellHandle`, `MOBILE_SHELL_READY_EVENT`,
`NATIVE_STATUS_EVENT`, and the helpers `isMobileShell`, `getMobileShell`,
`buildBridgeMessage`, `parseBridgeMessage`, `buildNativeStatusMessage`,
`parseNativeStatusDetail`.

Both web components now import it; the hand-written shapes and the `declare
global` are gone. 9 new tests (`packages/driver-core/src/__tests__/bridge.test.ts`)
cover version/namespace rejection, round-trip, and malformed payloads.

> **Mobile agent:** please replace `apps/mobile-driver/src/bridge/protocol.ts`
> with a re-export of `@tomp/driver-core` (it is already a declared dependency).
> The API is identical — `parseBridgeMessage` and `buildNativeStatusMessage`
> keep the same signatures — so `protocol.test.ts` should pass unchanged.

### 2. Dead deprecated export removed

`packages/api-client` exported `fetchDriverAssignmentByToken()`, whose whole body
was `throw new Error("… is deprecated …")`. Zero callers. Removed; doc 704 tidied
(it listed the wrapper and the real function separately).

---

## Original mobile findings — `apps/mobile-driver`

The list below is kept as the original review trail. Items marked P0/P1 above
were addressed after the review; the remaining action is real-device testing and
any UX refinement found during that run.

Ranked by impact as originally found.

### P0 — `flushOfflineQueue()` is never called: the outbox is write-only

`src/services/offline-queue.ts` exports `flushOfflineQueue`,
`getOfflineQueueCount` and `clearOfflineQueue`. **None has a caller anywhere in
the app.** The only queue function used is `enqueueOfflineAction`, from
`location.ts`.

Effect: a failed location ping is written to SQLite and **never sent again**. The
outbox grows to `MAX_QUEUE_SIZE` (2000) and then silently evicts the oldest rows.
The offline-resilience feature does not work at all, and the driver is never told
anything is pending.

Needs: a flush trigger (app foreground / `AppState` change, connectivity regained,
after a successful live send) and a pending-count indicator in the shell UI.

### P0 — the background location task drops failures instead of queueing them

```ts
// src/services/location.ts — TaskManager.defineTask(LOCATION_TASK_NAME, …)
await submitLocation({ … }, mobileSession).catch(() => undefined);
```

The **foreground** path goes through `submitOrQueueLocation()`, which enqueues on
failure. The **background** task calls `submitLocation` directly and swallows the
result — no enqueue, no retry. Background tracking is exactly the case where the
network is worst (driving through dead zones), so this is where pings are lost.

Fix: route the background task through `submitOrQueueLocation()` too.

### P1 — `postStatusToWeb` escaping corrupts any payload containing a backslash

```ts
// App.tsx
const serialized = JSON.stringify(payload).replace(/\\/g, "\\\\").replace(/`/g, "\\`");
webViewRef.current?.injectJavaScript(`… detail: ${serialized} …`);
```

`JSON.stringify` already produces valid JS literal syntax. Re-escaping
backslashes **double-escapes what JSON already escaped**: a message containing
`\n` becomes a literal backslash-n in the WebView. The backtick escape is inert —
the template literal is interpolated in RN before the string is ever evaluated,
so there is no backtick context to break out of.

Fix: drop both `.replace()` calls and instead apply the standard safe-embed
escapes for a `<script>`-like context:

```ts
const serialized = JSON.stringify(payload)
  .replace(/</g, "\\u003c")
  .replace(/\u2028/g, "\\u2028")
  .replace(/\u2029/g, "\\u2029");
```

### P1 — no request timeout on any mobile HTTP call

`driver-api.ts` and `mobile-session-api.ts` call `fetch` with no
`AbortSignal.timeout(...)`. On a stalled mobile connection the background task
hangs until the OS kills it, and the foreground UI waits indefinitely. Add a
timeout (10 s is reasonable for a location ping) to every call.

### P1 — auth failures are queued and retried forever

`submitOrQueueLocation()` enqueues on **any** `!result.success`, including a 401
from a revoked or expired mobile session. `flushOfflineQueue()` has **no attempt
cap** — it increments `attempt_count` but never evicts. A poison row therefore
sits at the head of the `order by created_at asc limit 100` window forever,
blocking newer rows from being retried.

Fix: treat auth failures as terminal (drop the row, surface "re-scan the QR"),
and evict any row past a max `attempt_count`.

### P2 — `sendAction()` can only replay `location`

Status: fixed after review.

Every other kind returns `{ success: false, error: "…ต้องส่งผ่าน Driver Web
session…" }`, i.e. a permanent failure. Latent today (nothing enqueues those
kinds) but it becomes a poison-row source the moment readiness/status/issue are
queued.

### P2 — three HTTP layers, three `ApiResult` shapes

Status: partially fixed after review. The phantom `@tomp/api-client` dependency
was removed from the mobile shell; `driver-api.ts` and `mobile-session-api.ts`
now share the same timeout/error behaviour, but the future shared transport
package is still a later architecture task.

- `packages/api-client/src/driver.ts` — the documented boundary (docs 810, 812)
- `apps/mobile-driver/src/services/driver-api.ts` — its own `requestJson`
- `apps/mobile-driver/src/services/mobile-session-api.ts` — a third `fetch`, with
  `success?: boolean` optional where `driver-api.ts` has it required

`@tomp/api-client` **and** `@tomp/driver-core` are declared dependencies of
`apps/mobile-driver` with **zero imports in its source** — only `@tomp/types` is
actually used. Either adopt the shared client or drop the phantom dependencies;
right now the documented architecture and the code disagree.

### P2 — `App.tsx` bridge bootstrap hardcodes the namespace and version

Status: fixed after review.

```ts
const bridgeBootstrap = `… namespace: "tomp.driver", version: 1, …`;
```

It does not interpolate `BRIDGE_NAMESPACE` / `BRIDGE_VERSION`, so bumping the
constants in `protocol.ts` would not update the injected handle — the same drift
class as the web issue fixed above, inside the app itself.

### P2 — mobile `requestJson` ignores `response.ok`

An HTTP 500 whose JSON body lacks `success` is indistinguishable from a soft
failure. The shared `api-client` version handles this (`!response.ok &&
payload.success !== false` → normalised error); the mobile copy does not.

---

## Checked and correct — do not re-investigate

- **Mission-control polling is not duplicated.** `live-location-map.tsx` looks
  like it double-polls, but `useStandaloneLocations(..., !feed)` disables its own
  10 s interval whenever the shared `MissionControlFeedProvider` is present. The
  provider owns polling inside the control room; the standalone poller only runs
  when the map is rendered on its own.
- **Web/mobile response shapes agree.** `MobileDriverAssignment` matches the
  `data` object `/api/driver/assignment` returns field-for-field, and the
  api-client's `result.data?.packet` matches the same payload.
- **Web shell branches are inert in a browser.** Every mobile-shell path in
  `driver-location-share.tsx` is behind `getMobileShell(window)`; the
  `tomp:native-status` listener never fires outside the shell.
- **Hot DB reads are index range scans** after `0028` (timeline / assignment
  status / issue-report windows). The `⚠ sequential scan` that
  `load-scenario.mjs` prints is a synthetic `distinct on` query the app never
  runs — see doc 962.

---

## Verification

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm test` — web 90/90, driver-core 23/23
- `npm test --prefix apps/mobile-driver` — 18/18 (adds driver API session/HTTP contract coverage and flush re-entrancy coverage)
- `npm run build` — 45/45 pages
