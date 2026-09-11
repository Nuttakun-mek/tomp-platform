# 975 — iOS: what is actually needed, and how ten drivers get the app

> **Folded into `976`, which is the single handoff note.** Kept for history —
> nothing here is required reading. Anything still live was moved, not summarised.

Written 2026-09-11. The target is concrete: **about ten drivers, five consecutive
days of real operation.** Everything below is judged against that, not against
"shipping to the App Store" in general.

---

## First, a correction

Three handoff notes (`966`, `972`, `974`) said `UIBackgroundModes: ["location"]`
was missing from `infoPlist` and called it "the one to fix first" for iOS.

**That was wrong.** `app.json` passes `isIosBackgroundLocationEnabled: true` to
the `expo-location` config plugin, and that plugin's `withBackgroundLocation`
pushes `"location"` into `UIBackgroundModes` through `withInfoPlist` at prebuild.
It is absent from the hand-written `infoPlist` block because it is *generated*.
Verified in `apps/mobile-driver/node_modules/expo-location/plugin/build/withLocation.js:26-36`
and its call site at line 106.

Worth noting how it survived: the first note read `app.json`, did not find the
key, and concluded it was missing. Each later note copied the claim rather than
opening the plugin. The docs are corrected.

---

## Distribution: TestFlight, not Ad Hoc

For ten drivers over five days:

| | Ad Hoc | TestFlight internal |
|---|---|---|
| device UDIDs collected up front | **all ten** | none |
| a driver's phone dies, swap to a spare | **new build, new install for everyone** | add the tester, done |
| shipping a fix mid-operation | send each driver a new file | push once, everyone updates |
| Apple review | none | **none** (internal only) |
| build lifetime | a year | 90 days — ample |

Ad Hoc's one advantage is avoiding review, and TestFlight *internal* avoids it
too. Only **external** TestFlight needs Beta App Review — and that reviewer will
ask about background location, which is the one thing this app cannot do without.
For a closed test with known drivers there is no reason to invite that.

**The trade-off to be aware of:** internal testers must be users on the App Store
Connect team (up to 100). Ten known drivers is fine; give them the lowest role
that works. If drivers must *not* have App Store Connect access at all, the
alternative is an external TestFlight group — which costs one Beta App Review
(typically a day or two) before the first build reaches anyone.

Recommendation: **TestFlight internal.** Start there; it needs nothing but the
paid membership.

**EAS builds iOS in the cloud, so no Mac is required** — which matters, since
development here is on Windows.

### The build profiles

`eas.json` now defines iOS for every profile:

- `development` — simulator, for the dev client.
- `preview` — `distribution: internal`, `simulator: false`. This is the **Ad Hoc**
  path, kept as a fallback. Registered devices only.
- `production` — store distribution. **This is the TestFlight path**, then
  `eas submit --platform ios`.

`submit.production` is deliberately empty: `eas submit` prompts for the Apple ID,
team and App Store Connect app, and none of those values exist until the account
is approved. Fill them in then, not now.

---

## What was actually wrong on iOS, and is now fixed

One real defect, found by reading expo-location's types rather than assuming the
config meant the same thing on both platforms.

**`timeInterval` is Android-only.** `Location.types.d.ts` marks it
`@platform android`, and iOS ignores it. Both watchers in
`src/services/location.ts` asked for a 10-second (foreground) and 30-second
(background) cadence with `distanceInterval: 0`, and the comment explained the
choice in terms that only hold on Android: *"time-driven, not distance-driven,
so a parked driver still looks alive."*

On iOS that configuration means something else entirely. `timeInterval` is
dropped, and `distanceInterval: 0` says "report every fix the GPS produces" —
a continuous stream for the whole shift. Over five days in a vehicle that is a
flat battery, not a busy map. And the heartbeat that keeps a parked driver on the
board had no guaranteed source of ticks, because it only ran when the OS chose to
deliver a location.

Three changes:

1. **The heartbeat has its own clock.** `startHeartbeat()` ticks every 30s,
   offers the last known fix to the same `decideLocationSend` rule, and that rule
   still decides whether anything is sent. `recordedAt` is stamped *now*, not
   copied from the old fix — a heartbeat means "still here, as of this moment",
   and reusing the old timestamp would arrive already stale. Harmless on Android,
   where the callbacks already arrive; on iOS it is the only thing keeping a
   stationary driver on the map. Stopped first in `stopLocationSharing()`, so a
   driver who stops sharing cannot be put back on the board by a stray tick.
2. **iOS gets a real distance gate** — `distanceInterval: LOCATION_MOVED_METERS`,
   the same distance the send rule already treats as movement. Android keeps
   `0`, where `timeInterval` bounds the callback.
3. **`activityType: AutomotiveNavigation` and `showsBackgroundLocationIndicator: true`**
   on the background task. The default activity type is `Other`, which is how iOS
   decides when GPS may be powered down; this is a vehicle. The indicator is the
   blue status bar — the driver should be able to see tracking is on, and Apple
   expects it to be visible.

The send rule these feed is unchanged and already covered by
`packages/driver-core/src/__tests__/location.test.ts` — *"holds a stationary fix
until the heartbeat is due"* and *"sends the heartbeat, flagged idle"* are exactly
the pattern the timer produces, so repeated offers of the same coordinates are
throttled to one per heartbeat window.

**Not unit-tested:** the timer's own lifecycle. `src/services/location.ts` imports
expo-location and expo-task-manager at module scope, so testing it means mocking
the native layer — brittle, and it would test the mock. The logic it delegates to
is tested; the wiring needs the device walk below.

---

## Still blocked on the Apple Developer Program

Everything here needs the paid membership, which was applied for on 2026-09-10
and was pending. Nothing below can start until it is approved.

1. **APNs key for push.** The FCM service account uploaded for Android does
   nothing on iOS. Expo needs an APNs auth key from the developer account,
   uploaded separately. Until then the iOS build runs fine but receives no
   notifications — which is survivable for a GPS test and not for a dispatch one.
2. **The first build and its credentials.** `eas build --platform ios --profile production`
   will create the bundle identifier, distribution certificate and provisioning
   profile on first run.
3. **Ten internal testers** added in App Store Connect, each with an Apple ID.
4. **`eas submit --platform ios`**, then enable the build for the internal group.

Also outstanding and unrelated to iOS: the FCM key rotation (`966`), still
required because the private key was pasted into a chat transcript.

---

## Before handing phones to drivers

Walk this on one iOS device first. None of it has ever run on iOS.

1. **Permissions.** iOS asks "While Using" first; background location needs
   **"Always"**, which the driver must choose in Settings. There is no Android-style
   battery-exemption prompt to offer — `battery.ts` correctly returns early off
   Android — so the pre-flight wording needs an iOS variant telling them to pick
   Always. **Currently the only platform note in `App.tsx` is Android-only
   (`Platform.OS === "android"`), so an iOS driver is told nothing.** Fix before
   the drivers get it.
2. **Background GPS parked, screen off, ten minutes.** The control room must show
   **"จอดอยู่" in blue**, never red. This is the change above; if it fails, the
   heartbeat timer is not surviving backgrounding and that is the finding.
3. **Battery over a full shift.** Note the drain on day one, before ten drivers
   depend on it for five days. If it is bad, the distance gate and
   `Accuracy.Balanced` are the levers.
4. **The blue status bar appears** while tracking in the background.
5. **QR scan, PIN, job open, photo capture** — the ordinary flow, since the camera
   and secure store paths have only ever run on Android.
6. **Notifications**, once the APNs key exists.

## Do not

- **Do not test background location on the simulator.** It does not reproduce
  CoreLocation's background behaviour, which is the entire risk on iOS.
- **Do not issue the test QRs from a local server.** `DRIVER_ACCESS_TOKEN_SECRET`
  differs between Vercel and `.env.local`, so a locally seeded QR returns
  "ไม่พบงานสำหรับลิงก์นี้" against production (`966`).
- **Do not ship the `development` profile to drivers.** It needs Metro running on
  a developer machine. `preview` or `production` only.
