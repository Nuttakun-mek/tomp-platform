# Agent handoff — build the iOS + Android driver app

Executable instructions for `apps/mobile-driver`. Strategy and reasoning live in
`953-mobile-app-plan.md`; **read section 2 (Option A vs B) and 4b (iOS) there
before starting.** This file is the "what to type".

Approach: **Option B — WebView shell + native GPS/push bridge.** The driver UI
stays single-source in the Next.js app (`/driver?token=`); the native app
supplies the two things a browser cannot do — background location and push.

---

## 0. Prerequisites — the human must do these first

| what | why | cost |
|---|---|---|
| Expo account with access to org **`enexiss-team`** | `app.json` already points at EAS project `ea9c91b8-049d-4287-bfcd-dad4ecc7981b` | free |
| **Apple Developer Program** | required even for TestFlight | $99/yr |
| Google Play Developer account | **only** if using Managed Play; not needed to side-load an APK | $25 once |
| 1 real Android phone + 1 real iPhone | the M1 spike is meaningless on simulators | — |

`eas login` must succeed before anything else. A Mac is **not** required — EAS
builds and signs in the cloud.

---

## 1. Orientation

**App:** Expo (SDK 57), `apps/mobile-driver`. Entry `App.tsx` (650 lines),
services in `src/services/` (`driver-api`, `location`, `offline-queue`,
`token-store`), config `src/config.ts` → `TOMP_API_BASE_URL`
(default `https://tomp-platform.vercel.app`, from `app.json` `extra.tompApiBaseUrl`).

**Keep** (these are the app's real value):
- `src/services/location.ts` — `TaskManager.defineTask` +
  `startLocationUpdatesAsync` with an Android foreground service. Correct.
- `src/services/token-store.ts` — SecureStore.
- `src/services/offline-queue.ts` — retry queue for GPS pings.
- QR scan + `tompdriver://?token=` deep-link handling in `App.tsx`.

**Delete in M3** (superseded by the WebView, and currently *behind* the web —
they bypass the PIN and capture no photos):
- `sendReadiness` / `sendStatus` / `reportIssue` screens in `App.tsx`
- `submitReadiness` / `submitStatus` / `submitIssue` in `src/services/driver-api.ts`
  and the `readiness|status|issue` branches of `offline-queue.ts`

**Verify after every task:** `cd apps/mobile-driver && npm run typecheck`

---

## Task M0 — fix the config bugs (30 min, do first)

**Why:** iOS background location does not work at all as configured — the one
reason this app exists. See `953` §4b.

`apps/mobile-driver/app.json`:

1. `expo.plugins` — replace the `expo-location` entry:
```jsonc
[
  "expo-location",
  {
    "locationAlwaysAndWhenInUsePermission": "อนุญาตให้ TOMP ใช้ตำแหน่งระหว่างปฏิบัติงาน เพื่อให้ศูนย์ควบคุมติดตามงานได้ต่อเนื่อง",
    "isIosBackgroundLocationEnabled": true,
    "isAndroidBackgroundLocationEnabled": true,
    "isAndroidForegroundServiceEnabled": true
  }
]
```
`isIosBackgroundLocationEnabled` is what injects `UIBackgroundModes: ["location"]`.

2. `expo.ios.infoPlist` — add `NSPhotoLibraryUsageDescription` (without it iOS
   **terminates** the app when the WebView's file picker offers the photo
   library) and reword the camera string, which still says "ในรุ่นถัดไป":
```jsonc
"NSCameraUsageDescription": "TOMP ใช้กล้องเพื่อสแกน QR งาน และถ่ายรูปรถ ป้ายทะเบียน เป็นหลักฐานก่อนเริ่มงาน",
"NSPhotoLibraryUsageDescription": "TOMP ใช้คลังรูปเมื่อคุณเลือกรูปรถหรือป้ายทะเบียนเป็นหลักฐาน"
```

3. Bump `expo.version` to `0.2.0`.

**Verify:** `npx expo prebuild --platform ios --clean` then confirm
`ios/TOMPDriver/Info.plist` contains `UIBackgroundModes` → `location`. Delete the
generated `ios/` afterwards (the project is managed-workflow; EAS prebuilds).

---

## Task M1 — spike the WebView on real devices ⛔ GATE

**Do not start M2 until this passes.** This is the one assumption Option B rests
on. Budget half a day.

1. `npx expo install react-native-webview`
2. Throwaway screen rendering:
```tsx
<WebView
  source={{ uri: `${TOMP_API_BASE_URL}/driver?token=${encodeURIComponent(token)}` }}
  javaScriptEnabled
  domStorageEnabled
  sharedCookiesEnabled                    // iOS: keeps the dpin_* PIN cookie
  thirdPartyCookiesEnabled                // Android: same
  allowFileAccess                         // Android: <input type=file>
  mediaCapturePermissionGrantType="grant" // iOS: camera inside the WebView
  originWhitelist={["*"]}
/>
```
3. On a **real Android phone and a real iPhone**, walk the whole driver flow:

| check | why it matters |
|---|---|
| PIN gate appears and accepts the code | the `dpin_<tokenId>` cookie is httpOnly, path `/driver` — cookie persistence must work |
| pre-flight opens the camera from `<input capture>` and **both photos upload** | ⚠️ the main risk, Android especially |
| chat scrolls, composer grows, keyboard doesn't cover it | |
| safe-area / notch correct, no horizontal scroll at 320 px | |
| reload the WebView → trip step and GPS consent survive | already server/localStorage backed |

**If photo upload fails on either platform:** do not abandon Option B. Fall back
to a *hybrid* — keep the WebView for everything, intercept the pre-flight photo
step via `postMessage`, capture with `expo-camera` natively and POST to
`/api/driver/evidence` (multipart: `token`, `kind`, `file`). That route already
exists and is token-authed.

---

## Task M2 — the shell + native GPS bridge

**Files:** `App.tsx`, new `src/services/bridge.ts`, and on the web side
`apps/web/components/driver/driver-location-share.tsx`.

### M2.1 — web detects the shell and delegates GPS
In `<DriverLocationShare>`:
```ts
type NativeBridge = { postMessage: (msg: string) => void };
const nativeShell = (): NativeBridge | null =>
  typeof window !== "undefined" ? ((window as unknown as { ReactNativeWebView?: NativeBridge }).ReactNativeWebView ?? null) : null;
```
- In `startSharing()`: if `nativeShell()` exists, send
  `postMessage(JSON.stringify({ type: "gps:start" }))` and **return** — do not
  call `watchPosition`, do not request a wake lock (native owns both).
- In `stopSharing()`: send `{ type: "gps:stop" }`.
- Listen for native status so the light stays honest:
```ts
useEffect(() => {
  function onNative(event: Event) {
    const detail = (event as CustomEvent<{ signal: "off" | "live" | "stale"; message?: string }>).detail;
    setSignal(detail.signal);
    if (detail.message) setMessage(detail.message);
  }
  window.addEventListener("tomp:gps", onNative);
  return () => window.removeEventListener("tomp:gps", onNative);
}, [setSignal]);
```
Keep the existing browser path untouched — the same page must still work in a
plain mobile browser.

### M2.2 — native handles it
`App.tsx`: replace the job screens with the WebView; keep token entry / QR scan /
deep link as the entry screen.
```tsx
async function onMessage(event: WebViewMessageEvent) {
  const msg = JSON.parse(event.nativeEvent.data) as { type: string };
  if (msg.type === "gps:start") {
    const fg = await Location.requestForegroundPermissionsAsync();
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (fg.status !== "granted") return pushSignal("off", "ยังไม่ได้รับสิทธิ์ตำแหน่ง");
    await startBackgroundLocationSharing();          // existing service, unchanged
    pushSignal(bg.status === "granted" ? "live" : "stale",
      bg.status === "granted" ? undefined : "แชร์ได้เฉพาะตอนเปิดแอป — เปิด 'ตลอดเวลา' ใน Settings");
  }
  if (msg.type === "gps:stop") { await stopLocationSharing(token); pushSignal("off"); }
}

function pushSignal(signal: "off" | "live" | "stale", message?: string) {
  webRef.current?.injectJavaScript(
    `window.dispatchEvent(new CustomEvent("tomp:gps",{detail:${JSON.stringify({ signal, message })}}));true;`
  );
}
```

### M2.3 — iOS permission downgrade (required, see `953` §4b)
On every `AppState` → `active`, call `Location.getBackgroundPermissionsAsync()`.
If it is no longer `granted` while sharing is on: `pushSignal("off", …)` **and**
POST a `driverIssueReportAction`-style notice so the **centre** sees
"GPS ถูกปิดสิทธิ์" instead of a silently stale marker.

### M2.4 — clean up
Delete the superseded native screens and `driver-api` helpers listed in §1. Keep
the GPS ping queue in `offline-queue.ts`; the web outbox
(`apps/web/lib/driver/outbox.ts`) already covers status/messages.

**Verify:** start sharing in the app → background it → lock the phone for 5 min →
the centre's fleet board keeps receiving pings and the GPS dot stays green.

---

## Task M3 — push notifications

1. `npx expo install expo-notifications`; register for a push token after the
   driver opens a job.
2. Send it up: extend `/api/driver/updates` (or a small `POST /api/driver/push`)
   to store it on `driver_access_tokens.metadata.pushToken`. Token-authed via
   `resolveDriverTokenContext()` — **never trust ids from the body** (see
   `952` §0 rule 2).
3. Server: after `sendDriverNotificationAction` succeeds, POST to
   `https://exp.host/--/api/v2/push/send`.
4. Tapping the notification deep-links to `tompdriver://?token=…`.

**Verify:** background the app → centre sends a message → notification arrives →
tapping it opens the job.

---

## Task M4 — build and distribute

```bash
cd apps/mobile-driver
npm i -g eas-cli && eas login

# internal testing — start here, no store review on either platform
eas build --profile preview --platform android   # → APK, side-load
eas build --profile preview --platform ios       # → TestFlight internal

# later, signed store builds
eas build --profile production --platform all
```

**Android:** the `preview` profile already emits an APK — download from the EAS
link and side-load. ⚠️ A **public Play Store** listing with
`ACCESS_BACKGROUND_LOCATION` triggers Google's Background Location declaration
(written justification + a demo video of the in-app disclosure); it routinely
takes weeks. Prefer side-load or Managed Google Play (private app).

**iOS:** **TestFlight internal testers need no review** — up to 100 people who
are users on your App Store Connect team. That is the fastest legitimate path.
For customers, use an **ABM Custom App** (unlisted). Do not plan on the
Enterprise Program. Full matrix in `953` §4b.

---

## Task M5 — hardening before wide rollout
- Measure battery over a real 8-hour shift before tuning
  `accuracy` / `distanceInterval` (currently `Balanced` / 25 m / 30 s).
- Android OEMs (Xiaomi, Oppo, Huawei, Vivo) kill foreground services — add an
  in-app "ปิดการประหยัดแบตสำหรับ TOMP" guide with per-brand steps.
- Driver tokens expire in 24 h — handle expiry with a clear "ขอ QR ใหม่จากศูนย์"
  screen, not a generic error.
- Add crash/telemetry (Sentry or EAS Insights) before scaling past the pilot.

---

## Order and gates

```
M0 (config bugs)  →  M1 SPIKE ⛔gate  →  M2 (shell + GPS)  →  M4-preview (APK/TestFlight)
                                                          →  M3 (push)  →  M4-production  →  M5
```

Ship **M0 → M1 → M2 → M4-preview** first: that puts a real app with working
background GPS and the *full current* driver UI on real phones, with no store
review on either platform.

## Must not ship
The app in its present state bypasses the PIN gate and captures no photo
evidence. Either complete M2, or do not let any driver use it.
