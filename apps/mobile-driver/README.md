# TOMP Driver (mobile)

React Native / Expo app for drivers. Handles the full field flow **including
background GPS** — location keeps streaming to the control centre with the screen
off or the app backgrounded (web `/driver` cannot do this).

## What it does
- Scan the job QR (or open the QR link — deep-links via `tompdriver://` scheme)
- Send readiness, trip status (arrived / onboard / completed), report issues
- Share GPS: foreground `watchPositionAsync` + **background** `startLocationUpdatesAsync`
  with an Android foreground-service notification
- Offline queue — actions are stored and retried when the signal returns

All endpoints hit the same production API (`src/config.ts` → `TOMP_API_BASE_URL`,
default `https://tomp-platform.vercel.app`): `/api/driver/assignment|readiness|status|issue|location`.

## Run locally (dev)
```
cd apps/mobile-driver
npm install
npx expo start          # scan with Expo Go for foreground-only testing
```
Background location needs a **dev client or a real build** (Expo Go can't run the
background task). Use `npx expo run:android` / `npx expo run:ios` on a device.

## Build for distribution (EAS)
```
npm i -g eas-cli
eas login
eas build --profile preview --platform android   # APK for side-loading / internal testing
eas build --profile production --platform all     # store builds
```
`eas.json` and `app.json` are already configured (bundle IDs `com.tomp.driver`,
Android `ACCESS_BACKGROUND_LOCATION` + `FOREGROUND_SERVICE`, iOS
`NSLocationAlwaysAndWhenInUseUsageDescription`). EAS `projectId` is set in
`app.json` → `extra.eas.projectId`.

## Deep link
`tompdriver://?token=<token>` opens the app straight into a job. The web
`/driver` page shows an "เปิดในแอป" button that uses this while sharing GPS.
