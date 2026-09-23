# Mobile Driver App Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the concrete gaps found in a 2026-09-23 audit of `apps/mobile-driver` (the native Expo shell) and the driver-facing screens it renders from `apps/web` inside a WebView, and make the app feel like a real native mobile app instead of "a web page in a frame."

**Architecture:** `apps/mobile-driver` is a thin React Native/Expo shell wrapping a WebView that loads driver screens served by `apps/web` (`/ground-transfer/driver`). Native and web sides talk over a small postMessage bridge whose shared types/helpers live in `packages/driver-core/src/bridge.ts` (imported by both sides — kept DOM-free and dependency-free so React Native can import it too). This plan's tasks are grouped by risk/size: cheap config and copy fixes first, then a moderate theming task, then two infra tasks that partly depend on the user's own accounts/credentials, and finally the one architectural change (instant tab switching) that touches the shared bridge package plus both native and web code.

**Tech Stack:** Expo SDK 57 / React Native 0.86 (`apps/mobile-driver`), Next.js 15 App Router (`apps/web`), a shared dependency-free TypeScript package (`packages/driver-core`), Vitest for tests on both the web and driver-core sides.

## Global Constraints

- **Scope:** `apps/mobile-driver/**` and `packages/driver-core/**` are fully in scope. Inside `apps/web`, only the driver-facing surface is in scope: `apps/web/app/ground-transfer/driver/**` and `apps/web/components/driver/**` (plus their test files). Do not touch any other `apps/web` route or component — a separate, concurrent session owns the rest of the web app.
- **No native builds.** Do not run `eas build`, do not submit anything to the App Store or Play Store, per the user's standing instruction earlier this session ("ไม่ build iOS Android"). Code-level changes, `npm run typecheck:mobile`, and `npm run test:mobile` are all in scope; producing a new native binary is not. `eas update` (Task 8's OTA publish) is a different action — it ships a JS-only update to an already-installed build, not a new native binary — but still needs the user's own EAS login, so it is called out per-task as something the user runs, not something to execute from this session.
- **No DB/production credentials are used or needed by this plan** — it touches no database code.
- **Language decision (made explicit 2026-09-23):** the native shell's TH/EN toggle is removed, not fixed by translating the driver screens — full translation of driver-facing copy is out of scope (adjacent to item 7 of the earlier web audit, which the user excluded). The existing `mobileCopy`/`mt()` scaffolding in `apps/mobile-driver/src/i18n/index.ts` and `locale-store.ts` stays as-is; only the interactive toggle control and its handler are removed. See Task 1.
- Before every commit: `git fetch --all` and confirm `git log HEAD..origin/main` is empty — no upstream drift committed on top of blindly.
- Do not use `git add -A` or `git add .` — stage only the exact files each task intends.
- Run `rm -rf apps/web/.next` before `npm run typecheck -w @tomp/web` whenever a task touches `apps/web` route/component files.
- Every task's final verification step must actually run and pass before that task is considered done — a claimed-but-unexecuted test is worse than no test (see Task 10's vitest-include fix, which exists specifically to avoid this failure mode).

---

### Task 1: Remove the non-functional TH/EN toggle

**Files:**
- Modify: `apps/mobile-driver/App.tsx`

**Interfaces:** None — pure removal, no new exports, nothing else depends on `changeLocale`.

The toggle in the topbar (`styles.localeSwitch`, lines ~604-616) sends `lang=en` to the web content, but no page under `apps/web/app/ground-transfer/driver/**` ever reads that query param — the toggle changes nothing on any screen a driver actually works from during a shift. Only the pre-scan activation screen's own hardcoded strings (via `mt(locale, key)`) would change, which is not what the control visibly promises (it sits inside `mode === "web"`'s topbar, visible on every job screen). Decision: remove the control rather than build out driver-screen translation.

- [ ] **Step 1: Remove the toggle UI**

In `apps/mobile-driver/App.tsx`, delete the `statusGroup`/`localeSwitch` block (the `<View style={styles.statusGroup}>...</View>` wrapping the TH/EN `Pressable` pair, lines 603-617), leaving the topbar's `identity` block as the sole child of `styles.topbar`.

- [ ] **Step 2: Remove the now-unused handler**

Delete the `changeLocale` callback (lines 174-179):

```typescript
const changeLocale = useCallback((nextLocale: MobileLocale) => {
  localeRef.current = nextLocale;
  setLocale(nextLocale);
  void saveMobileLocale(nextLocale);
  if (currentToken) setWebUrl(buildDriverWebUrl(currentToken, nextLocale, activeWebView));
}, [activeWebView, currentToken]);
```

Do **not** remove `locale`/`setLocale`/`localeRef` state, `getMobileLocale()`/`saveMobileLocale()` calls, or the `mobileCopy`/`mt()` scaffolding in `src/i18n/index.ts` — a shared deep link can still legitimately carry `?lang=en` (via `parseDriverLink` in `src/services/driver-link.ts`), and the activation screen's own strings correctly show English in that case. Only the interactive control and its handler are being removed.

- [ ] **Step 3: Remove the now-unused styles**

Delete `statusGroup`, `localeSwitch`, `localeButton`, `localeButtonActive`, `localeButtonText`, `localeButtonTextActive` from the `StyleSheet.create({...})` block at the bottom of the file.

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck:mobile && npm run test:mobile`
Expected: both clean (no reference to `changeLocale`, `MobileLocale` import in `App.tsx` may now be unused too — remove it from the import list at the top of the file if TypeScript flags it as unused).

```bash
git add apps/mobile-driver/App.tsx
git commit -m "Remove the TH/EN toggle: it never affected any driver work screen"
```

---

### Task 2: WebView error/retry screen

**Files:**
- Modify: `apps/mobile-driver/App.tsx`

**Interfaces:** None — a new local `webViewError` state, no exports.

Today, if the job page fails to load (bad signal, server hiccup), `react-native-webview` falls back to its own default native error view — no "ลองใหม่" button, no wording that matches the app. A driver in a low-signal area gets stuck looking at a blank/system error screen with no obvious recovery action.

- [ ] **Step 1: Add error state and a `renderError` view**

Add a new state near the other WebView-related state (after `const [canGoBack, setCanGoBack] = useState(false);`):

```typescript
const [webViewError, setWebViewError] = useState<string | null>(null);
```

Add a `renderError` prop to `<DriverWebView>` (alongside the existing `renderLoading` prop), and clear the error whenever a fresh load starts by setting `webViewError` back to `null` inside `handleNavigation` when `event.loading` is `true` (currently that branch just `return`s):

```typescript
const handleNavigation = useCallback(
  (event: WebViewNavigation) => {
    setCanGoBack(event.canGoBack);
    if (event.loading) {
      setWebViewError(null);
      return;
    }
    // ...unchanged below
```

Add the `onError` handler and the `renderError` render prop to `<DriverWebView>`:

```typescript
onError={(syntheticEvent) => {
  const { description } = syntheticEvent.nativeEvent;
  setWebViewError(description || "เชื่อมต่อไม่สำเร็จ");
}}
renderError={() => (
  <View style={styles.webErrorBox}>
    <TriangleAlertIcon />
    <Text style={styles.webErrorTitle}>เปิดหน้าคนขับไม่สำเร็จ</Text>
    <Text style={styles.webErrorText}>ตรวจสอบสัญญาณอินเทอร์เน็ตแล้วลองอีกครั้ง</Text>
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.webErrorRetryButton, pressed && styles.pressablePressed]}
      onPress={() => webViewRef.current?.reload()}
    >
      <Text style={styles.webErrorRetryText}>ลองใหม่</Text>
    </Pressable>
  </View>
)}
```

There is no icon library already in this project beyond what `lucide-react` provides on the web side (not available in React Native here) — use a plain `Text` glyph instead of an icon component: replace `<TriangleAlertIcon />` above with `<Text style={styles.webErrorGlyph}>⚠️</Text>`.

- [ ] **Step 2: Add the new styles**

Add to the `StyleSheet.create({...})` block, matching the existing `loading`/`loadingText` pattern already in the file:

```typescript
webErrorBox: {
  alignItems: "center",
  backgroundColor: colors.surface,
  bottom: 0,
  gap: space.sm,
  justifyContent: "center",
  left: 0,
  paddingHorizontal: space.xl,
  position: "absolute",
  right: 0,
  top: 0
},
webErrorGlyph: {
  fontSize: 32
},
webErrorTitle: {
  color: colors.ink,
  fontFamily: font.bold,
  ...text.title
},
webErrorText: {
  color: colors.muted,
  fontFamily: font.regular,
  textAlign: "center",
  ...text.body
},
webErrorRetryButton: {
  alignItems: "center",
  backgroundColor: colors.operation,
  borderRadius: radius.lg,
  justifyContent: "center",
  minHeight: TOUCH_MIN,
  marginTop: space.sm,
  paddingHorizontal: space.xl
},
webErrorRetryText: {
  color: colors.surface,
  fontFamily: font.bold,
  ...text.strong
}
```

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck:mobile && npm run test:mobile`

```bash
git add apps/mobile-driver/App.tsx
git commit -m "Add a retry screen when the driver WebView fails to load"
```

---

### Task 3: Haptic feedback on primary actions

**Files:**
- Modify: `apps/mobile-driver/package.json` (new dependency)
- Modify: `apps/mobile-driver/App.tsx`

**Interfaces:**
- Produces: a small `haptics.ts` wrapper is **not** introduced — call `Haptics.impactAsync(...)` directly at each call site listed below, matching this file's existing style of importing Expo modules directly rather than wrapping every one.

Scope: the native shell only (button presses inside `App.tsx`). Adding haptics to the WebView content itself would need a new native→web bridge message and is a larger, separate piece of work — not included here (YAGNI: nothing in this plan's scope needs it yet).

- [ ] **Step 1: Install the dependency**

Run: `npx expo install expo-haptics` (from `apps/mobile-driver` — this resolves the exact SDK-57-compatible version automatically, matching how every other `expo-*` dependency in `package.json` was added).

- [ ] **Step 2: Import and call at each action site**

Add near the top of `App.tsx`: `import * as Haptics from "expo-haptics";`

Call `void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` at the start of each of these existing handlers:
- `handleQrScanned` (successful scan — before `setQrLocked(true)`)
- `openScanner` (only in the branch where permission was already granted or just got granted, right before `setScannerOpen`)
- `confirmResetAssignment`'s `onPress` for the destructive "ออกจากงาน" alert button (feel of a committed, weighty action)
- `openDriverMenu` (tab switch — every tap, right before `setActiveDriverMenu`)

Use `Haptics.NotificationFeedbackType.Success` via `Haptics.notificationAsync(...)` (not `impactAsync`) at the one place that already represents a clear success/failure signal to the user: inside `handleBridgeMessage`'s `mobile-session.set` and `mobile-session.challenge` success branches (right after `setSessionReady(true)`), since that is the moment the app confirms "you can now work this job."

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck:mobile && npm run test:mobile`

```bash
git add apps/mobile-driver/package.json apps/mobile-driver/package-lock.json apps/mobile-driver/App.tsx
git commit -m "Add haptic feedback on scan, tab switch, session-ready, and leave-job"
```

---

### Task 4: iOS swipe-back gesture

**Files:**
- Modify: `apps/mobile-driver/App.tsx`

**Interfaces:** None.

`react-native-webview` supports `allowsBackForwardNavigationGestures` (an iOS-only WKWebView feature — a no-op, not an error, on Android). It is not currently set, so an iPhone user's edge-swipe — the gesture every other app on their phone honours — does nothing.

- [ ] **Step 1: Add the prop**

In `<DriverWebView>`'s prop list (alongside `geolocationEnabled`), add:

```typescript
// iOS only — WKWebView's own back/forward swipe gesture. Android's hardware
// back button is already handled above via BackHandler; this is the iOS
// equivalent affordance, which WebView does not enable by default.
allowsBackForwardNavigationGestures
```

- [ ] **Step 2: Verify and commit**

Run: `npm run typecheck:mobile`

```bash
git add apps/mobile-driver/App.tsx
git commit -m "Enable iOS swipe-back gesture on the driver WebView"
```

---

### Task 5: Fix the stale camera-permission description

**Files:**
- Modify: `apps/mobile-driver/app.json`

**Interfaces:** None.

`ios.infoPlist.NSCameraUsageDescription` currently reads "TOMP ใช้กล้องสำหรับสแกน QR และถ่ายหลักฐานงานใน**รุ่นถัดไป**" ("...evidence photos in a future version") — evidence photos are already a shipped, live feature (`DriverPhotoCheck` in `apps/web`, used during pre-flight and via the message composer). This is the text an iOS user reads the first time the app asks for camera access; it currently promises something already true as if it were not yet true.

- [ ] **Step 1: Update the string**

In `app.json`, change:

```json
"NSCameraUsageDescription": "TOMP ใช้กล้องเพื่อสแกน QR รับงาน และถ่ายรูปหลักฐานระหว่างปฏิบัติงาน"
```

- [ ] **Step 2: Verify and commit**

Run: `npm run typecheck:mobile` (a JSON-only change — this just confirms nothing else broke in the same working tree)

```bash
git add apps/mobile-driver/app.json
git commit -m "Fix stale iOS camera permission description (evidence photos already ship)"
```

---

### Task 6: Dark mode

**Files:**
- Modify: `apps/mobile-driver/src/theme.ts`
- Modify: `apps/mobile-driver/App.tsx`
- Modify: `apps/mobile-driver/app.json`

**Interfaces:**
- Produces: `apps/mobile-driver/src/theme.ts` exports `lightColors`/`darkColors` (same shape as today's `colors`), `lightOverlay`/`darkOverlay` (same shape as today's `overlay`), and a new hook `useAppTheme()` returning `{ scheme: "light" | "dark", colors: ThemeColors, overlay: ThemeOverlay }`. `radius`, `space`, `text`, `font` are unchanged (not color-dependent).
- Consumes: `react-native`'s `useColorScheme()`.

Scope: a real, working dark palette for the whole shell (readable at night, no blinding white), not a pixel-perfect re-skin of every shadow/elevation nuance — `radius`/`space`/`text`/`font` stay as they are.

- [ ] **Step 1: Split `theme.ts`'s color tables into light/dark**

Rename the existing `colors` export to `lightColors` and the existing `overlay` export to `lightOverlay` (values unchanged). Add `darkColors` and `darkOverlay` with the same keys, tuned for a dark background — e.g. (adjust by eye once running, these are the starting values):

```typescript
export const darkColors: typeof lightColors = {
  ink: "#e8eef5",
  muted: "#9fb0c2",
  canvas: "#0f1c28",
  surface: "#16222f",
  surfaceSoft: "#1b2a38",
  surfaceRaised: "#1e2f3f",
  line: "#2a3b4b",
  lineSoft: "#233444",
  placeholder: "#6d8194",
  operation: "#3ecfc0",
  operationDeep: "#8be2da",
  operationSoft: "#123a37",
  route: "#5b8def",
  success: "#4ade80",
  warning: "#f0b45e",
  warningSoft: "#3a2a12",
  warningLine: "#5a4420",
  danger: "#f87171",
  dangerSoft: "#3a1418",
  dangerLine: "#5a2026",
  command: "#081521",
  commandMid: "#0d2334",
  commandDeep: "#04101a",
  accent: "#8be2da",
  onCommand: "#d6e5ee",
  onCommandMuted: "#8fa4b6",
  successOnDark: "#86efac",
  warningOnDark: "#f8d181",
  dangerOnDark: "#fecaca"
};

export const darkOverlay: typeof lightOverlay = {
  faint: "rgba(255,255,255,0.06)",
  soft: "rgba(255,255,255,0.10)",
  frame: "rgba(255,255,255,0.7)",
  scannerLabel: "rgba(4,16,26,0.82)",
  successFill: "rgba(74,222,128,0.16)",
  warningFill: "rgba(240,180,94,0.14)",
  dangerFill: "rgba(248,113,113,0.16)"
};
```

Add the hook at the bottom of the file:

```typescript
import { useColorScheme } from "react-native";

export type ThemeColors = typeof lightColors;
export type ThemeOverlay = typeof lightOverlay;

export function useAppTheme(): { scheme: "light" | "dark"; colors: ThemeColors; overlay: ThemeOverlay } {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return scheme === "dark"
    ? { scheme, colors: darkColors, overlay: darkOverlay }
    : { scheme, colors: lightColors, overlay: lightOverlay };
}
```

- [ ] **Step 2: Let the shell pick a palette at runtime**

In `App.tsx`, add `const { scheme, colors, overlay } = useAppTheme();` inside `DriverShell()`, near the other hooks at the top of the function. Remove the top-level `import { colors, font, overlay, radius, space, text, TOUCH_MIN } from "./src/theme";` and replace it with `import { font, radius, space, text, TOUCH_MIN, useAppTheme } from "./src/theme";` (color tables now come from the hook, not a static import).

Turn the module-level `const styles = StyleSheet.create({...})` (currently ~700 lines at the bottom of the file) into a factory function `createStyles(colors: ThemeColors, overlay: ThemeOverlay)` that returns the exact same object, with every `colors.` and `overlay.` reference inside it referring to the function's parameters instead of a module-level import (mechanical, unambiguous find-and-replace across the whole block — the object's shape, keys, and every non-color value stay byte-identical). Inside `DriverShell()`, compute it once per theme change:

```typescript
const styles = useMemo(() => createStyles(colors, overlay), [colors, overlay]);
```

`StatusBar`/`ExpoStatusBar`'s `barStyle`/`style` props (currently hardcoded `"light-content"`/`"light"`) stay as-is — the topbar (`colors.command`) is always a dark navy in both themes by design (it is the brand bar, not the page background), so the status bar content should always stay light regardless of `scheme`. No change needed there.

- [ ] **Step 3: Let the OS decide automatically**

In `app.json`, change `"userInterfaceStyle": "light"` to `"userInterfaceStyle": "automatic"`.

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck:mobile && npm run test:mobile`
Manual check (no device build required — this can be eyeballed via `npx expo start` and toggling the simulator/emulator's system appearance, or skipped if no simulator is available in this session — note in the task report which was done): both the activation screen and an open job screen render legibly with the OS set to dark mode, and revert correctly when set back to light.

```bash
git add apps/mobile-driver/src/theme.ts apps/mobile-driver/App.tsx apps/mobile-driver/app.json
git commit -m "Add dark mode: theme.ts exposes light/dark palettes, shell follows the OS setting"
```

---

### Task 7: Skeleton loading instead of spinners

**Files:**
- Modify: `apps/mobile-driver/App.tsx`

**Interfaces:** None — depends on Task 6 only in that it should read colors from `useAppTheme()` rather than a static import (do this task after Task 6 lands).

Two spots currently show a bare `ActivityIndicator`: the font-loading gate (`if (!fontsLoaded) return ...`) and `<DriverWebView>`'s `renderLoading`. Replace both with a simple shape-matching skeleton (a pulsing placeholder, not a real shimmer-gradient library — no new dependency needed).

- [ ] **Step 1: Add a small pulse animation helper**

Add `Animated` to `App.tsx`'s existing `import { ActivityIndicator, Alert, AppState, ... } from "react-native"` list at the top of the file (one name added to that same import statement — no new import line). `useRef`/`useEffect` are already imported from `"react"`.

Add this function above `DriverShell()`:

```typescript
function usePulse() {
  const value = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0.4, duration: 700, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  return value;
}
```

- [ ] **Step 2: Font-loading skeleton**

Replace the `if (!fontsLoaded) { return (...) }` block's contents with a skeleton shaped like the topbar + a card, instead of a centered spinner:

```typescript
if (!fontsLoaded) {
  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.command} />
      <View style={styles.skeletonTopbar} />
      <View style={styles.skeletonBody}>
        <Animated.View style={[styles.skeletonCard, { opacity: pulse }]} />
        <Animated.View style={[styles.skeletonCard, styles.skeletonCardShort, { opacity: pulse }]} />
      </View>
    </View>
  );
}
```

This block runs before `colors`/`useAppTheme()` is meaningfully available in a fonts-not-loaded state on some cold starts — keep using the existing `colors.command` fallback exactly as the current code already does (it is a static import today; after Task 6, call `useAppTheme()` at the very top of `DriverShell()`, above the `fontsLoaded` check, so `colors` is available here too).

Call `const pulse = usePulse();` inside `DriverShell()`, above the `if (!fontsLoaded)` early return (hooks must run unconditionally on every render).

- [ ] **Step 3: WebView-loading skeleton**

Replace `renderLoading`'s contents similarly — a skeleton shaped like the operation strip + content card, instead of a spinner:

```typescript
renderLoading={() => (
  <View style={styles.loading}>
    <Animated.View style={[styles.skeletonStrip, { opacity: pulse }]} />
    <Animated.View style={[styles.skeletonCard, { opacity: pulse }]} />
  </View>
)}
```

- [ ] **Step 4: Add the new styles**

```typescript
skeletonTopbar: {
  backgroundColor: colors.commandMid,
  height: 68
},
skeletonBody: {
  gap: space.md,
  padding: space.lg
},
skeletonStrip: {
  backgroundColor: colors.line,
  borderRadius: radius.md,
  height: 40,
  marginBottom: space.md,
  marginHorizontal: space.md,
  marginTop: space.md
},
skeletonCard: {
  backgroundColor: colors.line,
  borderRadius: radius.xl,
  height: 140
},
skeletonCardShort: {
  height: 88
}
```

- [ ] **Step 5: Verify and commit**

Run: `npm run typecheck:mobile && npm run test:mobile`

```bash
git add apps/mobile-driver/App.tsx
git commit -m "Replace loading spinners with a pulsing skeleton on font-load and WebView-load"
```

---

### Task 8: Over-the-air (OTA) updates

**Files:**
- Modify: `apps/mobile-driver/package.json` (new dependency)
- Modify: `apps/mobile-driver/app.json`
- Modify: `apps/mobile-driver/eas.json`

**Interfaces:** None — this is configuration, not new app code (expo-updates' default `checkAutomatically: "ON_LOAD"` behavior needs no JS wiring).

Right now every JS-only bug fix needs a full native rebuild plus app-store review (days). `expo-updates` lets a JS/asset-only change reach installed devices in minutes via `eas update`, without a new store submission.

- [ ] **Step 1: Install**

Run: `npx expo install expo-updates` (from `apps/mobile-driver`).

- [ ] **Step 2: Configure `app.json`**

Add, at the top level of `expo`:

```json
"runtimeVersion": {
  "policy": "appVersion"
},
"updates": {
  "url": "https://u.expo.dev/ea9c91b8-049d-4287-bfcd-dad4ecc7981b"
}
```

(The project id matches `extra.eas.projectId`, already present in `app.json`.)

- [ ] **Step 3: Add channel mapping to `eas.json`**

`apps/mobile-driver/eas.json` currently has three build profiles: `development`, `preview`, `production`. Add a `"channel"` field to each, matching that profile's own name — this is what lets `eas update --channel production` target builds made from the matching profile:

```json
"build": {
  "development": {
    "developmentClient": true,
    "distribution": "internal",
    "channel": "development",
    "android": { "buildType": "apk" },
    "ios": { "simulator": true }
  },
  "preview": {
    "distribution": "internal",
    "channel": "preview",
    "android": { "buildType": "apk" },
    "ios": { "simulator": false }
  },
  "production": {
    "autoIncrement": true,
    "channel": "production",
    "android": { "buildType": "app-bundle" },
    "ios": { "simulator": false }
  }
}
```

Leave the `cli` and `submit` blocks exactly as they are.

- [ ] **Step 4: Verify**

Run: `npm run typecheck:mobile`
Expected: clean (config-only change plus one new dependency; no app code changed).

- [ ] **Step 5: Commit, then hand off**

```bash
git add apps/mobile-driver/package.json apps/mobile-driver/package-lock.json apps/mobile-driver/app.json apps/mobile-driver/eas.json
git commit -m "Wire up expo-updates so JS-only fixes can ship as OTA updates"
```

**Needs the user:** publishing an update (`eas update --channel <name> --message "..."`) requires the user's own EAS login and is a live push to installed devices — do not run it from this session. Note this clearly in the task report.

---

### Task 9: Crash reporting

**Files:**
- Modify: `apps/mobile-driver/package.json` (new dependency)
- Modify: `apps/mobile-driver/app.json`
- Modify: `apps/mobile-driver/index.ts`

**Interfaces:** None new — Sentry initializes itself at import time when a DSN is present.

Today, a native-layer crash in the field is invisible to the team — the only way bugs like the ones documented in `location.ts`'s comments (a unit going quiet for 59 minutes) get diagnosed is by someone noticing and digging through server-side ping logs after the fact. Add Sentry, but gate it on an env var that is not yet set — this task ships the plumbing; it does nothing until the user supplies a DSN.

- [ ] **Step 1: Install**

Run: `npx expo install @sentry/react-native` (from `apps/mobile-driver`).

- [ ] **Step 2: Initialize, gated on an optional env var**

In `apps/mobile-driver/index.ts` (the app's entry point — read it first to see its current content before editing), add near the top, before the existing `registerRootComponent` call:

```typescript
import * as Sentry from "@sentry/react-native";

// Unset by default — this ships the plumbing only. Someone with a Sentry
// account sets EXPO_PUBLIC_SENTRY_DSN (see app.json's `extra` or an EAS
// secret) to turn it on; nothing here requires that to exist.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0.2 });
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck:mobile && npm run test:mobile`
Expected: clean. With no `EXPO_PUBLIC_SENTRY_DSN` set (the default in this session), `Sentry.init` is never called — confirm this by reading the code, not by needing a live crash to test.

- [ ] **Step 4: Commit, then hand off**

```bash
git add apps/mobile-driver/package.json apps/mobile-driver/package-lock.json apps/mobile-driver/index.ts
git commit -m "Add crash reporting plumbing (Sentry), inert until a DSN is configured"
```

**Needs the user:** create a Sentry project (or equivalent), get a DSN, and set `EXPO_PUBLIC_SENTRY_DSN` (locally for dev, and as an EAS secret for real builds) — cannot be done from this session. Note this clearly in the task report.

---

### Task 10: Instant tab switching (no full WebView reload)

**Files:**
- Modify: `packages/driver-core/src/bridge.ts`
- Modify: `packages/driver-core/src/__tests__/bridge.test.ts`
- Modify: `apps/mobile-driver/src/config.ts`
- Modify: `apps/mobile-driver/src/bridge/protocol.ts`
- Modify: `apps/mobile-driver/App.tsx`
- Modify: `apps/web/components/driver/driver-task-view.tsx`
- Create: `apps/web/components/driver/driver-task-view.test.tsx`
- Modify: `apps/web/vitest.config.ts`
- Modify: `apps/web/package.json` (new devDependencies: `@testing-library/react`, `jsdom`)

**Interfaces:**
- Produces (`packages/driver-core/src/bridge.ts`): `export type DriverWebViewKey = "home" | "next" | "messages" | "gps"`, `export const VIEW_SWITCH_EVENT = "tomp:view-switch"`, `export function buildViewSwitchMessage(view: DriverWebViewKey): ViewSwitchMessage`, `export function parseViewSwitchDetail(detail: unknown): DriverWebViewKey | null`.
- Consumes (native): `packages/driver-core`'s new exports, this plan's Task 3 haptics call sites.
- Consumes (web): `packages/driver-core`'s new exports, `NATIVE_STATUS_EVENT`'s existing listener pattern in `driver-task-view.tsx` as the template for the new listener.

Today, tapping "หน้าหลัก / แผนงาน / ข้อความ / ตำแหน่ง" in the native bottom bar calls `setWebUrl(buildDriverWebUrl(...))`, which changes the WebView's `source.uri` — react-native-webview does a **full HTTP navigation** on every tap, and `apps/web/app/ground-transfer/driver/page.tsx` is an async Server Component that re-fetches `getDriverAssignmentByToken` from the database on every one of those navigations, even though the same driver/assignment data was already fetched for the previous tab seconds earlier. This is the single biggest reason the app currently feels like "a web page in a frame" rather than a native app, and it wastes a full server round-trip on every tab tap. Fix: load the job page once, and switch which section it shows via the existing native↔web bridge instead of a new page load.

- [ ] **Step 1: Add the native→web view-switch message to the shared bridge package**

Read `packages/driver-core/src/bridge.ts` in full first (this plan's own earlier research already has its full content, but re-read to catch any drift since). Add, following the exact pattern already used for `NATIVE_STATUS_EVENT`/`NativeStatusMessage`/`buildNativeStatusMessage`/`parseNativeStatusDetail`:

```typescript
/** CustomEvent the shell dispatches to tell the page which tab is now active. */
export const VIEW_SWITCH_EVENT = "tomp:view-switch";

export type DriverWebViewKey = "home" | "next" | "messages" | "gps";

export interface ViewSwitchMessage {
  namespace: typeof BRIDGE_NAMESPACE;
  version: typeof BRIDGE_VERSION;
  type: "view.switch";
  payload: { view: DriverWebViewKey };
}

export function buildViewSwitchMessage(view: DriverWebViewKey): ViewSwitchMessage {
  return { namespace: BRIDGE_NAMESPACE, version: BRIDGE_VERSION, type: "view.switch", payload: { view } };
}

const VIEW_KEYS: readonly DriverWebViewKey[] = ["home", "next", "messages", "gps"];

/** Read a `tomp:view-switch` CustomEvent detail without trusting its shape. */
export function parseViewSwitchDetail(detail: unknown): DriverWebViewKey | null {
  if (!isRecord(detail)) return null;
  const payload = detail.payload;
  if (!isRecord(payload) || typeof payload.view !== "string") return null;
  return (VIEW_KEYS as readonly string[]).includes(payload.view) ? (payload.view as DriverWebViewKey) : null;
}
```

Place this near `buildNativeStatusMessage`/`parseNativeStatusDetail` at the bottom of the file, after `NativeStatusPayload`/`NativeStatusMessage`.

- [ ] **Step 2: Test the new bridge functions**

Add to `packages/driver-core/src/__tests__/bridge.test.ts`, following the existing `describe("native status", ...)` block's style, a new block:

```typescript
describe("view switch", () => {
  it("builds a message for a valid view", () => {
    expect(buildViewSwitchMessage("next")).toEqual({
      namespace: BRIDGE_NAMESPACE,
      version: BRIDGE_VERSION,
      type: "view.switch",
      payload: { view: "next" }
    });
  });

  it("parses a valid detail and rejects everything else", () => {
    const message = buildViewSwitchMessage("messages");
    expect(parseViewSwitchDetail(message)).toBe("messages");
    expect(parseViewSwitchDetail({ payload: { view: "not-a-real-view" } })).toBeNull();
    expect(parseViewSwitchDetail({ payload: {} })).toBeNull();
    expect(parseViewSwitchDetail(null)).toBeNull();
  });
});
```

Add `buildViewSwitchMessage, parseViewSwitchDetail` to the existing `import { ... } from "../bridge"` list at the top of the test file.

Run: `npm test -w @tomp/driver-core` (or `npm test` from the repo root, which runs every workspace's suite including this one)
Expected: PASS, including the 2 new tests.

- [ ] **Step 3: Re-point the native shell's `DriverWebViewKey` at the shared package**

In `apps/mobile-driver/src/config.ts`, delete the local `export type DriverWebViewKey = "home" | "next" | "messages" | "gps";` (line 39) and replace it with `export type { DriverWebViewKey } from "@tomp/driver-core";` — one source of truth for this union, since the web side now needs it too.

- [ ] **Step 4: Re-export the new bridge symbols from the local shim**

In `apps/mobile-driver/src/bridge/protocol.ts`, add `buildViewSwitchMessage, VIEW_SWITCH_EVENT` to the existing `export { ... } from "@tomp/driver-core"` list, matching the file's existing style (it already re-exports `buildNativeStatusMessage`/`parseBridgeMessage` this way).

- [ ] **Step 5: Native shell posts a bridge message instead of reloading**

In `App.tsx`, add a callback mirroring `postStatusToWeb`'s existing pattern (which already injects a CustomEvent dispatch into the WebView):

```typescript
const postViewSwitchToWeb = useCallback((view: DriverWebViewKey) => {
  const message = buildViewSwitchMessage(view);
  const serialized = JSON.stringify(message)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  webViewRef.current?.injectJavaScript(`
    window.dispatchEvent(new CustomEvent("${VIEW_SWITCH_EVENT}", { detail: ${serialized} }));
    true;
  `);
}, []);
```

Add `buildViewSwitchMessage, VIEW_SWITCH_EVENT` to the existing `import { ... } from "./src/bridge/protocol"` list.

Change `openDriverMenu` so it no longer reloads the page:

```typescript
const openDriverMenu = useCallback((item: { key: DriverMenuKey; view?: DriverWebViewKey }) => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  activeDriverMenuRef.current = item.key;
  setActiveDriverMenu(item.key);
  if (item.key === "messages") {
    setHasUnreadMessages(false);
    void clearDeliveredNotifications();
  }
  if (item.view) postViewSwitchToWeb(item.view);
}, [postViewSwitchToWeb]);
```

(This removes the `if (currentToken && item.view) setWebUrl(buildDriverWebUrl(currentToken, localeRef.current, item.view));` line — the WebView's `source.uri` no longer changes on a tab tap. It also folds in Task 3's haptic call for this specific site instead of adding it separately, since this is the exact line Task 3 named for it — if Task 3 already landed first, this step just relocates that one call rather than duplicating it.)

`effectiveWebUrl`'s `useMemo` currently includes `activeWebView` in its dependency array and recomputes the URL with the new view baked in — since the URL must now stay fixed after the initial load, remove `activeWebView` from `buildDriverWebUrl`'s call inside that `useMemo` (drop the third argument, defaulting to `"home"`, since the initial load is always the home view — the native shell now owns which section is visible via the bridge message, not the URL).

- [ ] **Step 6: Web page manages its own view via bridge, not a fixed prop**

In `apps/web/components/driver/driver-task-view.tsx`:

Rename the `view` prop to `initialView` in the function signature: `export function DriverTaskView({ driverAccess, view: initialView = "home" }: { driverAccess: DriverAccessAssignment; view?: DriverTaskViewMode })`.

Add local state right after the other `useState` declarations: `const [view, setView] = useState<DriverTaskViewMode>(initialView);` (naming it `view` again for this local variable keeps every existing `view === "..."` check below unchanged — only the prop itself was renamed).

Add a new effect listening for the bridge event, placed next to the existing native-status effect (which already imports `NATIVE_STATUS_EVENT`/`parseNativeStatusDetail` from `@tomp/driver-core` — add `VIEW_SWITCH_EVENT`, `parseViewSwitchDetail` to that same import line):

```typescript
useEffect(() => {
  const handleViewSwitch = (event: Event) => {
    const nextView = parseViewSwitchDetail((event as CustomEvent).detail);
    if (nextView) setView(nextView);
  };
  window.addEventListener(VIEW_SWITCH_EVENT, handleViewSwitch);
  return () => window.removeEventListener(VIEW_SWITCH_EVENT, handleViewSwitch);
}, []);
```

The bottom `<nav>` rendered only when `!insideNativeShell` (the browser-testing fallback nav, explicitly labelled in its own copy as for testing before the app) is **not** changed by this task — it still uses `<Link href=".../driver?token=...&view=...">`, a real Next.js navigation. That path is deliberately out of scope: it exists solely for manually checking each screen in a desktop browser before testing on the phone, per its own on-page copy, and is never what an actual driver uses.

- [ ] **Step 7: Test the new listener**

This codebase's existing component tests (e.g. `app/(app)/page.test.ts`) call a **Server Component** directly as a plain async function and inspect the returned element tree — that pattern does not work here: `DriverTaskView` is a `"use client"` component whose behavior under test (a `useEffect`-registered event listener updating `useState`) only runs inside a real React render pass, which a bare function call cannot provide. This repo has no DOM test environment or React-rendering test library configured yet (`apps/web/vitest.config.ts` sets `environment: "node"`; `@testing-library/react` is not a dependency) — add both, scoped to this one file only via Vitest's per-file environment pragma, so the rest of the suite keeps running under the faster `node` environment unchanged.

Install: `npm install --save-dev @testing-library/react jsdom -w @tomp/web` (from the repo root, or `cd apps/web && npm install --save-dev @testing-library/react jsdom`).

Create `apps/web/components/driver/driver-task-view.test.tsx`. Read `apps/web/lib/data/driver-access.ts` first for the real, current shape of `DriverAccessAssignment` and fill in every field the component actually reads (per Task brief context: `assignment.metadata`, `assignment.id`, `assignment.status`, `driver.id`/`fullName`, `vehicle.id`/`plateNumber`/`vehicleType`/`capacity`, `project.id`/`projectName`/`projectCode`/`metadata`, `callSign.callSign`, `token`, `notifications`, `messages`, `dayAssignments`, `workSession`, `latestStatus`, `packet`) — do not guess these field names from this plan text alone, confirm each one against the real type before writing the fixture, since this plan's earlier research read the component's usage of them but not the full type definition itself.

```typescript
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VIEW_SWITCH_EVENT, buildViewSwitchMessage } from "@tomp/driver-core";
import { DriverTaskView } from "./driver-task-view";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function buildDriverAccess(): DriverAccessAssignment {
  // Fill in against the real, current DriverAccessAssignment shape — see the
  // note above this block. Every field DriverTaskView dereferences without an
  // optional-chain must be present or the render throws before the assertion
  // runs, which is itself a useful signal that a field was missed.
  return {
    /* ... */
  } as DriverAccessAssignment;
}

describe("DriverTaskView view switching", () => {
  it("switches the visible section when the shell posts a view-switch event, with no navigation", () => {
    render(<DriverTaskView driverAccess={buildDriverAccess()} view="home" />);
    expect(screen.getByText("รายการปฏิบัติงาน")).toBeInTheDocument();

    window.dispatchEvent(new CustomEvent(VIEW_SWITCH_EVENT, { detail: buildViewSwitchMessage("next") }));

    expect(screen.queryByText("รายการปฏิบัติงาน")).not.toBeInTheDocument();
    expect(screen.getByText("ลำดับงานที่ต้องดำเนินการถัดไป")).toBeInTheDocument();
  });
});
```

The `buildDriverAccess()` body (`as DriverAccessAssignment` cast over `{ /* ... */ }`) is the one placeholder in this entire plan, and it is deliberate: `DriverAccessAssignment` is a large domain type this plan's research read usages of but not the full field-by-field definition of, so writing a guessed fixture here would likely be wrong in a way that only surfaces as a confusing runtime crash during the task, not a caught spec gap. Every other code block in this plan is complete, real code.

- [ ] **Step 8: Widen the vitest include so this new test actually runs**

`apps/web/vitest.config.ts`'s `include` is currently `["lib/**/*.test.ts", "app/**/*.test.ts"]` — a component test under `components/**` would silently never run, exactly the failure mode a comment already in that file describes fixing once before for `app/**`. Change:

```typescript
include: ["lib/**/*.test.ts", "app/**/*.test.ts", "components/**/*.test.{ts,tsx}"]
```

(Widened to `.tsx` too, since this new test file is a `.tsx` — the existing two globs are `.test.ts` only because no test file under `lib/`/`app/` has needed JSX yet. Leave `environment: "node"` as the file-level default in this config — Step 7's `@vitest-environment jsdom` pragma comment overrides it for that one file only, which is why the config's shared default does not need to change.)

- [ ] **Step 9: Verify and commit**

Run, from the repo root: `rm -rf apps/web/.next && npm run typecheck -w @tomp/web && npm run lint -w @tomp/web && npm test`
Then, from `apps/mobile-driver`: `npm run typecheck:mobile && npm run test:mobile`

Expected: everything green, including the new driver-core bridge tests and the new `driver-task-view.test.tsx`.

```bash
git add packages/driver-core/src/bridge.ts packages/driver-core/src/__tests__/bridge.test.ts apps/mobile-driver/src/config.ts apps/mobile-driver/src/bridge/protocol.ts apps/mobile-driver/App.tsx apps/web/components/driver/driver-task-view.tsx apps/web/components/driver/driver-task-view.test.tsx apps/web/vitest.config.ts apps/web/package.json apps/web/package-lock.json
git commit -m "Switch driver tabs instantly via the native-web bridge instead of reloading the WebView"
```

---

## Self-review notes

- **Task ordering:** Tasks 1-9 are independent of each other and of Task 10, and can run in any order — Task 10 is ordered last because it is the largest, highest-risk change (touches the shared `packages/driver-core` package plus both native and web code) and because Step 5 explicitly folds in Task 3's haptic call, so Task 3 should land before Task 10 to avoid a duplicate haptic call site (noted inline in Task 10 Step 5).
- **Placeholder scan:** the one deliberate exception is Task 10 Step 7's `minimalDriverAccess()` stub, explained inline as to why a "read the real type first" instruction replaces a literal value there rather than a guessed/stale object shape — every other code block in every task is complete, real code, not a description of what to write.
- **Type/interface consistency:** `DriverWebViewKey`, `buildViewSwitchMessage`, `parseViewSwitchDetail`, `VIEW_SWITCH_EVENT` are each defined exactly once (in `packages/driver-core/src/bridge.ts`) and every other reference across Tasks 10's native and web steps imports that same definition — verified against the real current file contents of `bridge.ts`, `config.ts`, `bridge/protocol.ts`, `driver-task-view.tsx`, and `page.tsx`, not assumed from memory, during this plan's authoring on 2026-09-23.
- **Scope check:** confirmed during authoring that `apps/web/vitest.config.ts`'s test-include glob would silently swallow Task 10's new component test if left unwidened (Task 10 Step 8) — this is not scope creep, it is required for that same task's own deliverable to be genuinely tested rather than falsely reported green.
