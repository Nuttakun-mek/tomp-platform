# Mobile driver app — readiness plan

How to get `apps/mobile-driver` from "written but never built" to something
drivers actually use.

---

## 1. Where the app is today

**Already working (and valuable):**
- QR scan (`expo-camera`) + manual token paste + `tompdriver://?token=` deep link
- Token stored in `expo-secure-store`
- **Background location** — `TaskManager.defineTask` + `startLocationUpdatesAsync`
  with an Android foreground-service notification and
  `pausesUpdatesAutomatically: false`. **This is the one thing the web genuinely
  cannot do**, and it is implemented properly.
- Offline queue with retry (`src/services/offline-queue.ts`)
- Hits the same production API; already sends `x-driver-token` on write routes
- `app.json` / `eas.json` fully configured: EAS `projectId`, owner
  `enexiss-team`, bundle IDs `com.tomp.driver`, all permissions and plugins,
  build profiles (development / preview / production)

**The problem — the app is a generation behind the web driver:**

| capability | web `/driver` | mobile app |
|---|---|---|
| PIN gate (6 หลัก) | ✅ required | ❌ **absent — token alone opens the job** |
| Pre-flight screen (vehicle card + confirms) | ✅ | ❌ hardcoded all-true |
| Evidence photos (required before start) | ✅ 2 required | ❌ none (`app.json` still says "ในรุ่นถัดไป") |
| 2-way chat with the centre | ✅ polling thread | ❌ shows initial notifications only |
| Trip step flow / resume after restart | ✅ from `latestStatus` | ❌ raw status buttons |
| งานวันนี้ (`dayAssignments`) | ✅ | ❌ |
| Issue type picker | ✅ 6 types | ❌ one hardcoded issue |
| Background GPS | ❌ browser limitation | ✅ |
| Push notifications | ❌ | ❌ |

**Shipping the app as-is would be a regression**: drivers on mobile would bypass
the PIN and produce no photo evidence.

---

## 2. The decision that shapes everything

### Option A — bring the native app to parity
Rebuild pre-flight, PIN, photos, chat, trip steps, day list in React Native.

- Every driver feature then has to be written **twice**, forever.
- The web driver changed substantially in the last few days alone (pre-flight,
  photos, chat, outbox, resume). Drift is not hypothetical — it already happened.
- Any UI fix needs an app-store release.

### Option B — WebView shell + native GPS bridge ✅ **recommended**
The Expo app becomes a thin native shell:
- a `WebView` loading `https://…/driver?token=<token>` — the **entire driver UI
  stays single-source in Next.js**
- the **native side keeps ownership of background location** (the existing
  `TaskManager` task), posting to `/api/driver/location` with the stored token
- native adds **push notifications** and the QR scanner / deep-link entry

Why this is right here:
- The web driver is already phone-shaped (`100svh`, safe-area insets,
  `max-w-[520px]`, single column from ~320 px) — done in Phase K/N.
- The only things a browser truly cannot do are background GPS and push. The app
  supplies exactly those two.
- Driver UI ships by deploying the web app — **no store review for UI changes**.
- PIN, photos, chat, pre-flight all work on day one because they *are* the web
  screens.

**Trade-off to accept:** the photo upload runs inside the WebView
(`<input type="file" capture="environment">`). That works in WKWebView on iOS and
in Android WebView provided `react-native-webview` is configured with
`allowsFileAccess`, `mediaCapturePermissionGrantType: "grant"` and camera
permission. **Validate this before committing** — it is the single technical risk
of Option B (see M1.1).

---

## 3. Plan

### Phase M0 — de-risk (do first, ~half a day)
- **M0.1** Spike: `react-native-webview` loading `/driver?token=…` on a real
  Android device + a real iPhone. Verify: camera opens from
  `<input capture>`, photo uploads, geolocation permission prompt, chat scroll,
  safe-area. **If the photo upload fails on either platform, revisit A vs B now**
  (fallback: keep the WebView for everything but hand photo capture to a native
  screen that posts to `/api/driver/evidence`).
- **M0.2** Confirm Expo account access to org `enexiss-team` and the EAS project.

### Phase M1 — the shell
- **M1.1** Add `react-native-webview`. Replace `App.tsx`'s screens with:
  `token entry / QR scan` → `WebView(/driver?token=)`.
  Keep `extractToken`, deep-link handling, and SecureStore as-is.
- **M1.2** Wire the native GPS bridge:
  - the WebView posts `window.ReactNativeWebView.postMessage({type:"gps:start"})`
    when the driver taps share (add a tiny `window.TOMP_NATIVE` detection in
    `<DriverLocationShare>`; when running inside the shell it delegates instead
    of calling `watchPosition`)
  - native starts/stops `startLocationUpdatesAsync`, keeps posting in background
  - native pushes status back into the WebView (`injectJavaScript`) so the GPS
    light stays honest
- **M1.3** Offline queue stays native and also covers the bridged pings.
- **M1.4** Remove the now-dead native screens (readiness/status/issue buttons)
  and their `driver-api` helpers, so there is only one implementation.

### Phase M2 — push notifications
- **M2.1** `expo-notifications`; register the Expo push token per driver token,
  store it on `driver_access_tokens.metadata.pushToken`.
- **M2.2** Server: after `sendDriverNotificationAction`, send an Expo push.
  Replaces 15 s polling for a backgrounded phone.
- **M2.3** Deep-link the notification to the job.

### Phase M3 — build & distribute
Commands (from `apps/mobile-driver`):
```bash
npm i -g eas-cli && eas login
eas build --profile preview    --platform android   # APK, internal
eas build --profile production --platform all       # store builds
```
**Recommended rollout: internal distribution first.**
- Android: `preview` profile already emits an **APK** → download link from EAS →
  side-load onto driver phones, or push through **Managed Google Play (private
  app)**. No public store listing, **no Play review**.
- iOS: **TestFlight** internal testing (up to 100 devices, no full review).

⚠️ **Do not plan on a public Play Store launch without budgeting for it.**
`ACCESS_BACKGROUND_LOCATION` triggers Google's **Background Location Access
declaration**: a written justification plus a **demo video** of the in-app
disclosure, and it commonly takes weeks and multiple rejections. A private/
internal distribution avoids the whole process. Apple similarly requires a clear
justification for `Always` location.

Prerequisites the user must supply:
- Expo account with access to `enexiss-team` *(free tier is enough for internal builds)*
- Android: nothing for side-loading; a Google Play Developer account ($25 one-time) only if you go the Managed-Play/store route
- iOS: Apple Developer Program ($99/yr) — required even for TestFlight

### Phase M4 — hardening before wide rollout
- Battery: `Accuracy.Balanced` + distance filter is already sensible; measure a
  real 8-hour shift before tuning.
- Android OEM battery killers (Xiaomi/Oppo/Huawei) silently kill foreground
  services — add an in-app "ปิดการประหยัดแบตสำหรับแอปนี้" guide.
- Token lifecycle: tokens expire in 24 h; the app must handle expiry gracefully
  and prompt for a new QR.
- Crash/telemetry (Sentry or EAS Insights).

---

## 4. Suggested sequence

| step | outcome |
|---|---|
| M0 | know whether Option B holds — 1 spike, reversible |
| M1 | one driver UI, background GPS works, app is *usable* |
| M3 (preview build) | APK in drivers' hands for real testing |
| M2 | push replaces polling |
| M3 (production) | signed builds, TestFlight / Managed Play |
| M4 | battery + OEM + telemetry before scaling up |

**Ship M0 → M1 → M3-preview first.** That gets a real app onto real phones with
background GPS and the full current driver UI, without a store review.

---

## 4b. iOS specifics for Option B

### 🔴 Bug found — iOS background location is not actually enabled
`app.json` has the usage strings but **`UIBackgroundModes` is missing**, and the
`expo-location` plugin is configured without `isIosBackgroundLocationEnabled`.
`startBackgroundLocationSharing()` calls `Location.startLocationUpdatesAsync(...)`
— on iOS, without the background mode, updates stop the moment the app is
backgrounded. **The single reason this app exists does not work on iOS today.**

Fix in `app.json`:
```jsonc
["expo-location", {
  "locationAlwaysAndWhenInUsePermission": "อนุญาตให้ TOMP ใช้ตำแหน่งระหว่างปฏิบัติงาน",
  "isIosBackgroundLocationEnabled": true,      // adds UIBackgroundModes: ["location"]
  "isAndroidBackgroundLocationEnabled": true,
  "isAndroidForegroundServiceEnabled": true
}]
```
Also add `NSPhotoLibraryUsageDescription` — `<input type="file" accept="image/*">`
inside the WebView can offer the photo library, and iOS terminates the app if the
key is absent. (`NSCameraUsageDescription` is present but still says
"ในรุ่นถัดไป" — reword, reviewers read these.)

### Why Option B is fine on iOS
The WebView never needs geolocation: **native owns GPS** and posts to
`/api/driver/location`. WKWebView geolocation is unreliable and dead in the
background anyway, so this split avoids the problem instead of fighting it.
`<input type="file" capture="environment">` opens the camera natively in
WKWebView and is dependable — the iOS side of the M0.1 spike is low risk.

### The real iOS risk: App Store Review 4.2 (Minimum Functionality)
Apple rejects apps that are "a website bundled in a wrapper". Our defence is
genuine: background location tracking, push notifications, native QR scanning,
Keychain-backed token storage. That normally passes — but reviewers vary, and it
is the one thing that can block a public release.

**The answer is to not go through public review at all.** For an internal fleet
tool, ranked:

| route | review? | limits | fit |
|---|---|---|---|
| **TestFlight — internal testers** | **none** | 100 testers, each an App Store Connect user | ✅ **start here** — builds live in minutes |
| TestFlight — external testers | light Beta App Review | 10,000 testers; builds expire in 90 days | pilot beyond 100 drivers |
| **Custom App via Apple Business Manager** | yes, but unlisted | distributed privately to a specific org | ✅ best when TOMP is sold to a company |
| Ad Hoc | none | 100 devices/yr, register every UDID | small pilot, admin-heavy |
| Enterprise Program ($299/yr) | none | own employees only; Apple requires ~100+ staff + D-U-N-S and often refuses | ❌ don't plan on it |

**Recommended: TestFlight internal for the pilot → Custom App (ABM) for
customers.** Neither needs a public listing.

### iOS behaviour to design for
- **Two-step permission.** iOS grants "While Using" first; "Always" needs a
  second prompt or a trip to Settings. Show an in-app explainer *before*
  requesting, or drivers deny it.
- **Silent downgrade.** iOS periodically asks "keep allowing background use?" and
  a driver can flip it to "While Using", killing tracking with no error. On every
  foreground, re-check `getBackgroundPermissionsAsync()`; if it dropped, warn the
  driver *and* surface it to the centre as "GPS ถูกปิดสิทธิ์" rather than a silent
  stale marker.
- The blue status pill while background location runs is normal — tell drivers.
- Low Power Mode throttles updates; iOS may terminate the app and only relaunch
  on significant location change. Expect coarser tracks than Android's foreground
  service, and don't set alert thresholds tighter than ~2 min.

### Cost / prerequisites (iOS)
- **Apple Developer Program — $99/yr, required even for TestFlight.**
- A Mac is **not** needed — EAS builds and signs in the cloud
  (`eas build -p ios --profile preview`); EAS can manage certificates.
- For ABM Custom Apps the customer organisation needs an Apple Business Manager
  account and gives you their ABM org ID.

## 5. What must NOT ship
- The app in its current state: it bypasses the PIN and captures no photo
  evidence. Either complete Option B, or gate the app behind the same PIN +
  pre-flight before any driver uses it.
