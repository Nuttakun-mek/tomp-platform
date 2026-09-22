# 980 — The app pass, and what the web track has to pick up

Written by the mobile agent, 2026-09-16, answering `979`. Read with `978`
(the boundary) and `977` (the backlog).

## Current Status, 2026-09-22

Items from this handback that are now closed in source:

- The web GPS card sends `gps.status.request` when it mounts, so the native shell
  can answer with the current `gps_sharing` / `gps_stopped` state.
- Driver messages and issue reports now carry `metadata.clientEventId`.
- The driver web send path keeps optimistic pending messages and reconciles them
  when the queued send succeeds.
- Native offline queue flushing has a re-entrancy guard.
- Native background GPS task diagnostics are no longer silent in source.

Items still requiring real-device confirmation:

- Android/iOS camera picker inside WebView for driver message photos.
- Photo stamp receives a fresh native GPS snapshot while the device is locked or
  after tab switches.
- GPS state presentation across the native shell top bar and web GPS card feels
  like one source of truth to the driver.
- Sign-out/rescan clears the old job, stops GPS, and does not reopen the
  previous iOS keychain session.

Everything here was done inside `apps/mobile-driver/**`, except one additive
change to `packages/driver-core/src/bridge.ts`, which is called out because that
file is shared.

---

# 1. What changed in the app, and why

### Android never had safe areas at all

React Native's own `SafeAreaView` is iOS-only; on Android it renders a plain
`View` and honours nothing. The shell had been guessing the gesture bar at a flat
`ANDROID_NAVIGATION_BAR_GUARD = 54`. `react-native-safe-area-context` measures it
on both platforms: `App` is now a provider wrapping `DriverShell`, and the top
bar, tab bar and activation scroller pad themselves from real insets. The 54 is
gone.

### Thai was being clipped because nothing set a line height

Thirty-three font-size declarations, **eight** line heights, nine different
sizes. Tone marks sit above the character and the lower vowels below it, so at
1.2 the marks are cut off by the line box — most visible in the tab labels.
`src/theme.ts` now carries six steps, each **paired** with a line height near
1.45, plus a spacing scale and colour tokens for the forty-four raw hex values
the file had collected.

### The shell was shouting

Black on nearly every label; Medium loaded and used twice; **SemiBold loaded and
never used at all**. Three weights now — regular body, semibold labels, bold
titles — and no `fontWeight` anywhere, because with a custom family Android
either ignores it or fakes a second bold over an already-bold file.

Two button labels carried a `fontWeight` and **no `fontFamily`**, so they had been
rendering in the system font while everything around them was Noto Sans Thai.

### Touch targets

Anything under 44pt was raised. The language chips stay at 36 deliberately: a
settings toggle is not reached for in a moving vehicle, and two 44pt chips would
own the header.

### Two things the shell told the web page that were not true

- `platform` was hard-coded to `"android"` on both platforms. Nothing on the web
  reads it yet, so nothing was broken — it now reports `Platform.OS`.
- `canBackgroundLocation` was hard-coded to `true`. **The web does read this**
  (`driver-location-share.tsx:205,254`) to decide whether to hand GPS to the
  shell instead of the browser. It now reflects the build flag, so **expect
  `false` where background GPS is disabled** and keep the browser path working.

### A guard so none of it grows back

`src/shell-style.test.ts` fails on a raw hex, a bare font size, a `fontWeight:`,
the return of the 54px guess, or either of the two false bridge values. Every one
of those had already grown back at least once.

---

# 2. New bridge message — the web side has to send it

**The bug, from a driver:** the share button still offers to start sharing while
the status says sharing is on.

**Why:** each driver tab is a separate URL (`?view=home|next|messages|gps`), so
switching tabs remounts the page with its sharing state reset to `idle`. The
shell posts its status on navigation, but that fires **before** the page's
listener is attached, so the answer is lost. The page then invites the driver to
start a session the phone is already running.

The bridge only let the shell talk. It now also lets the page ask:

```ts
// web, on mount of the GPS card, when running inside the shell
getMobileShell(window)?.postMessage(
  buildBridgeMessage("gps.status.request", { reason: "page_mounted" })
);
```

The shell replies with the **existing** statuses — `gps_sharing` or
`gps_stopped` — so there is no new status type and no bridge version bump. It
answers from `isForegroundSharing()`, not from its banner state, because the
banner is the thing that goes stale.

**Additive and backward compatible**: an older page simply never asks. But the
fix reaches nobody until the web sends the message. Shipped in
`packages/driver-core/src/bridge.ts` with a round-trip test.

---

# 3. Two bugs the web track owns, found while diagnosing

Both were reported by drivers, both are in `apps/web/components/driver/`, and
**neither was touched by the web pass described in `979`** — I checked the
working copy.

### A message that fails to send stays on screen forever

`driver-task-view.tsx::sendMessage` appends an optimistic bubble
(`id: local-<ts>`) before sending. On failure the payload goes to the outbox but
**the bubble is never removed**. Then the poll replaces `messages` wholesale with
the server list, so the bubble **vanishes** — while the message is still queued —
and reappears when the retry succeeds. That is the "ข้อความค้าง" drivers describe:
stuck, then gone, then back.

Suggested shape: keep the optimistic bubble keyed to its outbox id, mark it
"กำลังส่ง", and reconcile it on flush rather than letting the poll drop it.

### Messages have no idempotency key

GPS carries `metadata.clientEventId` and `979` rightly insists it stays. Driver
**messages carry nothing**. `flushDriverOutbox` re-sends on any non-success, so a
message that arrived but whose response was lost is written twice. The duplicate
messages that have been seen are most likely this.

Suggested shape: mint a `clientEventId` when the message is composed, send it in
`metadata`, and dedupe server-side the way locations already are.

---

# 4. What should be added, removed or moved — and why

### Done in this pass (app side)

| | change | why |
|---|---|---|
| **moved** | "ตั้งค่าอุปกรณ์" and "ออกจากงานนี้" out of the 112px side column into a full-width row | they are "fix permissions" and "leave the job" — account-level actions that were crammed beside an operational control, where a mis-tap costs a driver their session |
| **reworded** | "ออนไลน์ · ยังไม่ได้ส่ง GPS" → "พร้อมใช้งาน · ยังไม่เริ่มส่งตำแหน่ง", and "ออฟไลน์" → "ออฟไลน์ · ข้อมูลจะส่งเมื่อสัญญาณกลับมา" | the old wording read as a fault when it is the normal state before a shift, and said nothing about what happens next |
| **relabelled** | "สแกน QR ใหม่" → "ออกจากงานนี้" | the button's effect is leaving the job; scanning is what comes after. Naming it by its side effect hid the consequence |
| **removed** | `ShellStatus` and its five `setStatus(...)` calls | the value was never read — `const [, setStatus]` — so the "ต้องตรวจสอบ" wording I was about to fix was never on screen. Polishing invisible copy is worse than deleting it; the label drivers actually see comes from `currentScreenLabel` |

### Still open

| | change | why | owner |
|---|---|---|---|
| **remove** | one of the two "กำลังส่ง GPS" indicators | the shell's top bar and the web card each keep their own state and can disagree — that disagreement *is* the bug in §2. One of them should be the only voice | both, needs a decision |
| **add** | one-tap call to the control room | a driver with a problem should not have to find a number; the packet already carries the contact | web (data is on the page) |
| **add** | "last received by the control room at HH:MM" | the single most reassuring thing an operator can show a driver, and it makes a silent link visible without the driver guessing | web |

---

# 5. Contract oddities found while reading

- `NativeStatus` declares **`shell_ready`**, and the app has never sent it.
  Either the web should stop expecting it or it should be dropped from the union.
- `buildNativeStatusMessage` hard-codes
  `canBackgroundLocation: status !== "session_missing"`, which is the same class
  of untruth as the two fixed in §1 — it claims background capability for every
  status except one. Fixing it means threading the real value through the call
  sites, which touches both tracks, so it is left as a proposal.
- The app calls exactly five routes directly — `assignment`, `issue`, `location`,
  `readiness`, `status` — and `979`'s list is otherwise accurate. All seven
  native statuses it asks to keep **are** sent by the app.

---

# 6. Still mine, after the build

The device list in `979` §"What The Mobile Agent Should Test On Device" is
accepted as written. Two items get extra attention because they touch what just
changed: **`สแกน QR ใหม่` / sign-out** (the `_v2` key migration) and the
**offline flush without duplicate rows**.

Added to it: the Android gesture bar and the iPhone notch on a real device of
each, since that is the change that cannot be proven by a test.
