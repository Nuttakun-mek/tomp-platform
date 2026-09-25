# 988 — iOS: releasing TOMP Driver as an Unlisted App Store app

Date: 2026-09-25. Decision (owner, 2026-09-25): distribute through the App Store
as an **Unlisted** app — it goes through full App Review once, never appears in
search, and installs only from its direct link. TestFlight stays for testing.

Account holder: **Nuttakun Mekarun** (App Store seller name). Operator shown on the
public pages: **Craftory Lab (Nuttakun Mekarun)**; App Store copyright **2026 Craftory Lab**. Contact `nuttakun.mek@gmail.com`
(both public, set in `apps/web/lib/legal/operator.ts`).

## 0. Already in place

| Item | Where |
|---|---|
| Privacy Policy URL | https://tomp-platform.vercel.app/privacy (public, TH + EN) |
| Support URL | https://tomp-platform.vercel.app/support (public, TH + EN) |
| Export compliance | `ITSAppUsesNonExemptEncryption: false` in `app.json` |
| Background location | `expo-location` plugin with `isIosBackgroundLocationEnabled` (see `975`) |
| App Store Connect app | `ascAppId 6811029020`, team `32589P2H8M`, bundle `com.tomp.driver` |
| Device family | iPhone only, portrait (`supportsTablet: false`) — no iPad screenshots needed |

## 0.1 Set in App Store Connect through the API on 2026-09-25

Version `1.0.0` (`b85af22c-…`, PREPARE_FOR_SUBMISSION), **release type MANUAL**;
`app.json` / `package.json` version bumped to `1.0.0` to match. Category Business /
Navigation. Content rights: no third-party content. Thai and en-US: subtitle,
privacy policy URL, description, keywords, support URL (text as in §2). Age
rating answers (all none; messaging and chat = yes, for the control-room chat).
Availability **Thailand only**, new territories off. Price **free**.

Still to do by hand in App Store Connect: **App Privacy** (no API for it; answers
in §3), **screenshots**, **App Review Information** (contact phone number, plus
the demo link and PIN in the notes — §4), attaching the build, submitting.

## 1. Order of work

1. **Production auth — done 2026-09-25**, verified by reading the config back:
   Site URL `https://tomp-platform.vercel.app`, redirect allow-list
   `https://tomp-platform.vercel.app/**`, public sign-up disabled (invites use the
   admin API and are unaffected). Still confirm migrations `0043`–`0047` are applied.
2. **Build** (owner): set `expo.version` to `1.0.0`, optionally set
   `EXPO_PUBLIC_SENTRY_DSN`, then `eas build -p ios --profile production`
   (`autoIncrement` bumps the build number).
3. **Device test through TestFlight internal** — the checklist in `982` §6 and
   `975` "Before handing phones to drivers": While Using → Always, parked with
   the screen off for ten minutes, blue status bar, camera, notifications.
4. **Demo job for the reviewer** — last, right before submitting (§4).
5. **Fill in the listing** (§2, §3) and choose **Manually release this version**
   so an approval cannot publish the app publicly before Unlisted is granted.
6. **Submit for review**, availability **Thailand only** (keeps the open EU DSA
   trader case 102959627884 out of the path).
7. **Request Unlisted distribution** — Apple's form at
   https://developer.apple.com/contact/request/unlisted-app/ — with the app's
   Apple ID `6811029020`. It can be filed while the version is in review.
   Reason to give: an internal tool for one organisation's contracted drivers,
   useless without a job QR issued by the control room.
8. After Apple grants Unlisted, release the approved version and hand drivers
   the App Store link. JS-only fixes afterwards go out with EAS Update on the
   `production` channel (same `runtimeVersion`); anything native needs a build.

## 2. Listing text

- **Name:** TOMP Driver
- **Subtitle (≤30):** Driver app for TOMP transport jobs
- **Category:** Business (secondary: Navigation). **Age rating:** 4+.
- **Keywords (≤100):** driver,transport,dispatch,shuttle,fleet,gps,event,control room,รถรับส่ง,คนขับ
- **Description (EN):**

  > TOMP Driver is the driver app for transport jobs run on the TOMP platform.
  > Scan the job QR code from your control room, enter your PIN, and the app
  > shows your job, route and messages. While you are on a job it shares your
  > location with the control room — in the background too, if you allow it — so
  > they can see where every vehicle is. Take photos of the vehicle and proof of
  > work, report problems, and call or message the control room in one tap.
  >
  > The app is for drivers who have been given a job by an organiser using TOMP;
  > it has nothing to show without one.

- **Description (TH):**

  > TOMP Driver คือแอปสำหรับคนขับในงานรับส่งที่บริหารด้วยระบบ TOMP สแกน QR
  > งานจากศูนย์ควบคุม กรอก PIN แล้วดูงาน เส้นทาง และข้อความได้ทันที ระหว่างงาน
  > แอปส่งตำแหน่งให้ศูนย์ควบคุม รวมถึงตอนแอปอยู่เบื้องหลังหากคุณอนุญาต
  > ถ่ายรูปรถและหลักฐานงาน แจ้งปัญหา และโทรหรือส่งข้อความถึงศูนย์ควบคุมได้ในแตะเดียว
  > แอปนี้ใช้ได้เฉพาะคนขับที่ได้รับงานจากผู้จัดงานที่ใช้ TOMP

- **Screenshots:** 6.9" iPhone (1320 × 2868), 3–5 shots: job screen, map/GPS
  status, messages, photo check. Take them from a **second** demo job, never
  the reviewer's: a QR binds to the first device that opens it.

## 3. App Privacy answers

Tracking: **No** (nothing is used to track across other companies' apps).

| Data type | Collected | Linked to the user | Purpose |
|---|---|---|---|
| Precise Location | Yes | Yes | App Functionality |
| Photos | Yes | Yes | App Functionality |
| Other User Content (messages, problem reports) | Yes | Yes | App Functionality |
| Name, Phone Number | Yes — conservative: entered by the organiser, shown and used by the app | Yes | App Functionality |
| Device ID (random installation id for device binding) | Yes | Yes | App Functionality |
| Crash Data | Only if a Sentry DSN is set | No | App Functionality |

Nothing else (no advertising data, no analytics SDK, no contacts, no health).

## 4. Demo job and Review Notes

Build it in production from the web UI, as the owner, right before submitting:

1. A project named e.g. `APPLE-REVIEW-<date>` — **not** smoke-tagged, so
   `purge_smoke_test_data()` cannot delete it (that is how the last one died).
2. One unit with a driver and vehicle, one mission, one job spanning at least
   the next 14 days.
3. Issue the QR with an expiry of **≥ 14 days** (default is 24 h — the first
   submission failed on exactly that).
4. Mark the driver checked in / ready and the job active, so the reviewer lands
   on the job screen and not the Thai preflight that demands vehicle photos.
5. **Do not open the link or enter the PIN yourself** — the first device to
   claim it owns it.

Review Notes (English):

> TOMP Driver is an internal app for drivers contracted by one organisation. It
> has no sign-up: a control room issues each driver a job QR code and PIN.
>
> To review: open this link on the review device — <LINK> — and enter PIN
> <PIN>. The app opens a live demo job.
>
> Background location: while a driver is on a job, the control room must see
> where the vehicle is even when the phone is in a pocket or mounted with the
> screen off. Location is only sent during an active job and stops when the job
> ends or the driver turns sharing off. The blue status bar shows while it runs.
>
> The interface is in Thai because the drivers are in Thailand.

## 5. Do not

- Do not let the approved version auto-release before Unlisted is granted.
- Do not purge smoke-test data while a review is open without checking the
  demo project is not tagged.
- Do not re-use a demo QR that anyone has already opened.
