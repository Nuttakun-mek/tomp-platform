# 976 — The handoff

**This is the only note you need to open.** `971`–`975` are folded into it and
reduced to pointers; nothing was dropped. Written 2026-09-11 at the close of a
live test with real drivers. Every number came from the pings, not from reading
the code.

---

# 1. The four surfaces, and how they connect

This is the thing to understand first, because *where* a change lands decides how
it reaches people — and today two nearly identical bugs needed completely
different releases.

```
   ┌──────────────────────────────────────────────┐
   │  apps/web        control room · dispatch ·   │  deploy → live instantly
   │                  customer fleet view ·       │  nobody installs anything
   │                  the driver web page         │
   └──────────────────┬───────────────────────────┘
                      │  reads pings, decides what they mean
                      │  lib/domain/gps-freshness.ts   ← WEB ONLY
                      │
   ┌──────────────────┴───────────────────────────┐
   │  packages/driver-core                        │  shared rule: when to send,
   │  what a phone sends and when                 │  and is it standing still
   └────────┬──────────────────────────┬──────────┘
            │                          │
   ┌────────┴─────────┐      ┌─────────┴──────────┐
   │  apps/mobile-    │      │  driver web page   │
   │  driver (native) │      │  in a browser      │
   │  Android + iOS   │      │                    │
   └──────────────────┘      └────────────────────┘
     needs a BUILD and          ships with the web
     drivers must INSTALL       deploy, instantly
```

| Change lands in | Reaches users by | Who has to act |
|---|---|---|
| `apps/web/**` | `vercel --prod --yes` | nobody |
| `apps/web/lib/domain/gps-freshness.ts` | same — **interpretation is web-side** | nobody |
| `packages/driver-core/**` | web deploy **and** an app build | drivers install, for the app half |
| `apps/mobile-driver/**` | an app build | drivers install |

**Why it matters.** Today's "parked driver goes red" was fixed web-side and
reached every driver in ninety seconds. "The position is wrong" lived in the
app's accuracy setting and needed a build, a QR, and every driver reinstalling.
Same symptom class, completely different release path. Ask which side a fix
belongs on *before* writing it.

**The native app is a shell around the web driver page.** It owns GPS,
notifications, the camera and the QR scanner; everything the driver reads is the
web page inside a WebView. So most driver-facing copy and flow changes are web
changes and need no build — see `apps/mobile-driver/src/bridge/protocol.ts`,
which re-exports the contract from `driver-core` so the two cannot drift.

---

# 2. Where things stand

| | |
|---|---|
| working tree | clean |
| **web** production | `2026.09.11.1958`, smoke 15/15 |
| CI | green, both jobs |
| migrations | 0001–0038 applied, mirror in sync |
| tests | 35 web files · 6 driver-core · 5 mobile · no skips |
| **Android** — drivers hold | the 19:35 build, **contains the heartbeat bug** (§6 round 4) |
| **Android** — built, held back | `fZHegoTOT59nmLyMV94Ho0ppKu8n_D2s_FYkjjV8_2c.apk` — heartbeat fixed |
| **iOS** — on TestFlight | 0.2.0 (2), built **before every GPS fix**; must not reach a driver |

The owner stopped testing to batch the remaining UI work into one final app
update. **Do not distribute a build until §3 is done.**

---

# 3. WEB — do this first

All four are `apps/web`. None needs an app build; each is live the moment you
deploy.

### 3.1 Show the age of every position ← highest value

`lib/format/relative-time-th.ts` already formats it. The board shows a colour and
nothing else, so an operator cannot tell a position reported ten seconds ago from
one reported nine minutes ago.

**Every bug found today would have been caught hours earlier if the age were on
screen.** A marker claiming to be current while the driver says they are a
kilometre away is obvious the instant the card reads "ล่าสุด 9 นาทีที่แล้ว", and
invisible when it only shows blue. Colour says whether to worry; the number says
what happened — and a number cannot lie the way a colour can.

Put it on: `fleet-board.tsx`, `live-location-map.tsx`, `live-tracking-map.tsx`
popups, `vehicle-task-card.tsx`, `fleet-view.tsx`.

### 3.2 The Mission Control legend is wrong

`components/mission-control/live-location-map.tsx:179-181` hand-writes three rows
— green "< 35 วิ", amber "> 35 วิ", rose "> 2 นาที". Those thresholds stopped
applying when devices began reporting their own cadence, **"จอดอยู่" is missing
entirely** though blue markers appear, and today added a fourth state. The legend
is teaching the control room a rule the system no longer uses.

`components/fleet-view/fleet-legend.tsx` is the shape to copy: it generates rows
from the `GpsFreshness` values and `TRACKING_MARKER_COLORS`, so a state cannot
reach the map without reaching the legend. Delete the hand-written rows and drop
the numbers from the copy.

### 3.3 Check-in photo on the unit card

Finding 3 of `971`, never started. `call-sign-access-panel.tsx` never receives
evidence. The data exists: `getVehicleEvidenceByProjectId` returns it keyed by
assignment, `latestEvidenceByDriver` maps it to the driver. Load it in
`app/(app)/assignments/page.tsx` beside `observerLinks` and render a thumbnail.

### 3.4 Message sender colours

Finding 2 of `971`, never started. `comms-console.tsx` styles inbound by severity
and outbound as one blue, so with several drivers in a thread nothing says who is
speaking. Reuse `accentFor` from `call-sign-access-panel.tsx` and move severity to
a left border or an icon.

---

# 4. MOBILE (both platforms) — then build once

### 4.1 One code change to include

Needed for §7, and it needs a build, so it belongs in this batch:

```ts
} catch {
  return false;   // no log, no reason, nothing to diagnose from
}
```

`startBackgroundLocationSharing()` swallows its own failure, which is why an
evening went on guessing whether background tracking had even started.

### 4.2 Build and ship

Credentials for both platforms are stored on EAS, so **both run
non-interactively** — no Apple ID, no 2FA, no prompts.

```bash
set -a && source <(grep -E '^EXPO_' .env.local | sed 's/^/export /;s/=\(.*\)$/="\1"/') && set +a
cd apps/mobile-driver

eas build --platform android --profile preview --non-interactive
eas build --platform ios --profile production --non-interactive
eas submit --platform ios --latest --non-interactive
```

After an iOS build, `app.json` gains a new `buildNumber` — **commit it**, or the
next build starts from 1 and App Store Connect rejects it as a duplicate.

---

# 5. ANDROID and iOS differ — know which you are dealing with

### ANDROID — how it reaches a driver

A URL to an `.apk`. Generate a QR pointing at it and the driver scans, downloads,
installs over the top; login and jobs survive. The artifact link expires in about
30 days.

They will hit two Android warnings — "this file may be harmful" and "not allowed
to install from this source". Both are normal for a non-Play-Store build; the
second is a one-time per-device setting.

**Android-specific behaviour that bit us:** the OS defers background work once the
device stops moving and the screen goes off, foreground service or not. That is
the root of §6 rounds 1 and 2, and every threshold in `gps-freshness.ts` exists
because of it. `timeInterval` works here and is what bounds the callback rate.

### iOS — how it reaches a driver

`eas submit` uploads to **App Store Connect, which is not the App Store**.
TestFlight **internal** testing needs no Apple review at all; only external does,
and an external reviewer would question the background location this app cannot
work without. Keep it internal.

Internal testers must first be users on the App Store Connect team (Users and
Access → invite → **the driver accepts by email**), then be added to the
TestFlight group. That acceptance depends on the driver, so send invitations the
night before, never the morning of.

Settled facts, so nobody re-derives them: bundle id `com.tomp.driver`, ASC app id
`6811029020`, Apple team `32589P2H8M` (Individual), APNs key `YHDK3V3N93`.

**iOS-specific behaviour:** `timeInterval` is **Android-only** and iOS ignores it,
so the cadence the code asks for does not exist there — delivery is governed by
`distanceInterval` alone. The background task deliberately uses `0` on both
platforms: on iOS the app is kept alive *by* the location stream, so a distance
gate would let a parked vehicle produce no updates, the OS would suspend the
process, and the heartbeat would die exactly when it is the only thing left.

**A correction worth keeping:** three earlier notes claimed `UIBackgroundModes`
was missing from `infoPlist` and called it the first thing to fix on iOS. It is
not missing — `isIosBackgroundLocationEnabled: true` makes the `expo-location`
plugin generate it at prebuild. The first note read `app.json`, did not find the
key, concluded it was absent, and the next two copied the claim without opening
the plugin.

### iOS has never run on a phone

Not one item below has ever been walked on an iPhone. Do it on **one** device
before ten drivers depend on it.

1. **Permissions.** iOS offers "While Using" first; background location needs
   **"Always"**, chosen in Settings. There is no Android-style battery-exemption
   prompt to offer — `battery.ts` correctly returns early off Android. The status
   card now tells iOS drivers what to set; check the wording appears.
2. **Parked, screen off, ten minutes.** The board must read **"จอดอยู่" in blue**,
   never red.
3. **Battery over a full shift**, before five days of it.
4. **The blue status bar** shows while tracking in the background.
5. **QR scan, PIN, open a job, capture a photo** — the camera and secure-store
   paths have only ever run on Android.
6. **Notifications**, once an APNs key is uploaded (§8).

**Do not test background location on the simulator.** It does not reproduce
CoreLocation's background behaviour, which is the entire risk.

**Do not ship the `development` profile to drivers** — it needs Metro running on
a developer machine. `preview` (Android) or `production` (iOS) only.

---

# 6. What today taught

Four rounds of GPS fixes went out. **Three were wrong.** The pattern is worth more
than the fixes: every wrong one came from reasoning about how the platform
*should* behave, every right one from opening the data.

## Round 1 — parked drivers turning red *(web-side fix)*

```
gaps while moving:  32s, 32s, 32s, 32s   (like clockwork)
gaps once stopped:  175s, then 401s      (against a 180s limit)
```

Android defers background work once the device stops moving. The heartbeat is
only sent when the OS delivers a location, so when the OS stops delivering, the
heartbeat stops with it. The fix widened the window. **Wrong instinct.**

## Round 2 — the fix that lied instead *(web-side fix)*

A unit nobody had heard from in ten minutes now sat on the board in the same calm
blue as one reporting perfectly. The owner named it: *a long fuse before red is
itself a deception, because everything before it reads as a working connection.*

Worse, the allowance was keyed on the last ping's `idle` flag, which breaks in
traffic: a vehicle creeping more than `LOCATION_MOVED_METERS` sends that ping as
*moving*, so the deferral that follows is judged on the tight window. Stop-and-go
is the normal state of a Bangkok shift, not an edge case.

**Now:** three bands, keyed on the device reporting a cadence at all.

```
within cadence + 60s                     live / idle — believe the ping
until cadence + 60s + GPS_SLOW_GRACE     "สัญญาณช้า", amber — said the moment the link goes quiet
beyond that                              offline
```

The warning is what lets the final limit stay generous without deceiving anyone.
A long fuse only misleads when the states before it look fine. The grace runs from
the end of the device's own fresh window, not a fixed clock — a device promising a
ten-minute heartbeat has a fresh window longer than a ten-minute deadline, and a
fixed deadline called it offline while it was keeping its word.

## Round 3 — "but it was always right before" *(app-side fix)*

That detail was the diagnosis. It had been right: the web page has always asked
for `enableHighAccuracy`, and the drivers only moved to the app that day. The
background task asked for `Accuracy.Balanced`, which resolves from cell towers:

```
11:49:27  13.877301,100.550622  acc= 52m
11:51:44  13.877301,100.550622  acc=100m  idle   ← identical
11:54:02  13.877301,100.550622  acc=100m  idle   ← identical
12:00:05  13.877301,100.550622  acc=100m  idle   ← identical, +363s
12:10:06  13.877301,100.550622  acc=100m  idle   ← identical, +601s
12:10:38  13.880945,100.540335  acc= 25m         ← real fix: 1.2km away
```

A tower does not move, so the send rule read zero metres of movement and reported
a vehicle driving across town as parked. **Two fixes:** the background task asks
for `Accuracy.High`, and a fix vaguer than the distance being measured no longer
claims the vehicle is stationary — past `LOCATION_MOVED_METERS` of uncertainty the
ping goes without the `idle` flag, because it cannot prove what it asserts.

## Round 4 — the heartbeat pinned moving vehicles in place *(app-side fix)*

Reported as "the location does not move", then "it jumped". Both, three seconds
apart, twice:

```
12:53:56  heartbeat idle  13.880906,100.539708     12:53:59  foreground  13.875365,100.536094   (600m)
13:02:48  heartbeat idle  13.875365,100.536094     13:02:48  foreground  13.861176,100.533812   (1.6km)
```

Read the second pair: the heartbeat re-sent **the exact coordinates from nine
minutes earlier**, stamped current and flagged parked, in the same second a real
fix placed the vehicle 1.6km away.

It was added that morning for the iOS parked case, with a comment saying a
heartbeat means "still here, as of this moment" — true while parked, a lie the
instant the vehicle moves, and the code had no way to tell which case it was in.
That is the whole problem with asserting something you did not check.

**Now:** the heartbeat asks. It runs only when one is due, requests a position
then, and sends what comes back with that fix's own timestamp. If it cannot get
one it sends nothing — silence reads as a slow signal and says so, where a stale
position dressed as current says the opposite of the truth.

---

# 7. The one thing still unexplained

Gaps of **321s, 346s, 529s** between sent pings, when the heartbeat should fire
every 120s. The timer itself was frozen, so the whole app was suspended — pings
then arrived in bursts, several different mechanisms landing in the same second as
everything thawed at once. `mode=background` pings stopped entirely after 12:48
while `foreground` and `heartbeat` continued, so the background task appears to
have died rather than merely been throttled.

The owner confirmed the obvious causes are **not** it: battery **unrestricted**,
location **allow all the time**, the app's own status line **GPS สด**.

**Do not guess at this.** Three guesses were spent and all three were wrong. Do
§4.1 first so the failure can speak, then reproduce it and watch `mode=background`
specifically.

---

# 8. Waiting on the owner

1. **Upload the APNs key** so iPhone drivers get notifications. The key exists
   (`YHDK3V3N93`, in `apps/mobile-driver/credentials/`) but EAS refuses to create
   or register push keys with an API key — *"Only user authentication is
   supported"* — and Apple ID login fails on this machine with *"iTunes service
   key is empty"*, which upgrading eas-cli did not fix. **Upload through the
   expo.dev web UI**: project **tomp** → Credentials → iOS → Push Key. The web
   path does not touch the broken CLI auth.
2. **Rotate the FCM service-account key** — its private key was pasted into a chat
   transcript on 2026-09-10, so treat it as disclosed. It works; rotation is
   housekeeping, but not optional.
3. **Revoke the old Expo token** beginning `MUi7Y`, still valid, sitting in a
   transcript on disk.
4. **`google-services.json` in git?** Google documents it as safe to commit and it
   holds no secret. A preference, not an incident.
5. **Align `DRIVER_ACCESS_TOKEN_SECRET`** between Vercel and `.env.local`, or keep
   the split deliberately.
6. **Reconnect Vercel to GitHub?** Would remove a manual step and a class of "I
   pushed, so it is live".

---

# 9. Bilingual rollout *(web only)*

Unmoved: **1,168 Thai literals across 114 `.tsx` files**, plus 107 `.ts` files.
One page (`/fleet`) is fully converted and is the worked example.

**The order follows who cannot read the screen, not how big the screen is.**
Operators are Thai staff. The people who need English are the observer
(`app/track/[token]`), a non-Thai driver, and anyone on the login and error
pages — and **none of those mounts `LanguageSwitcher`**, which lives only in
`components/app-shell.tsx`. Converting strings without adding the switcher leaves
`?lang=` as the only way in, and nobody hands out a URL with a query string.

Order: `track` → driver surface → login/errors → จัดงาน → ศูนย์ควบคุม →
resources → projects → superadmin last.

The scaffolding works and should be used, not rebuilt: `I18nKey` is derived from
the `th` dictionary, `en` is typed against it so a missing translation fails
`typecheck`, and `t()` renders `⟦some.key⟧` in development when a key is missing.

**Rules:** Thai is the default, English is a display layer. Never translate
database enums, permission keys, role keys, or column names. Keep TOMP, Call Sign,
QR, GPS, Google Maps as they are. Changing language must not write a timeline
event.

**Server-side error strings** cannot be translated where they are thrown — the
action does not know the locale. `app/actions/fleet-pin.ts` shows the pattern:
return a code, resolve it against the dictionary in the component. Extend from
`lib/actions/db-error.ts`, **after** two or three page groups, not before.

**Extend the no-Thai-literal guard** (`lib/fleet-access/no-actions.test.ts`) to
each surface as you finish it.

**Also fix `/track` while you are there.** It shows coordinates as text with a
Google Maps link and draws no map at all, for the passenger it exists to serve.
`LiveTrackingMap` is right there.

---

# 10. Things that will bite you

Every one cost real time. None is hypothetical.

## Read the pings before theorising

```
node scripts/inspect-pings.mjs                      # every unit active recently
node scripts/inspect-pings.mjs "ดอกไม้ แจกัน ริมธาร"   # one unit, ping by ping
```

Prints the gap between pings, each fix's accuracy, whether the device claimed to
be standing still, and which band the board shows. Fixes too coarse to justify a
"parked" reading are flagged. Every correct diagnosis today came from it; every
wrong one came from reasoning about the platform instead.

## Green locally means nothing about CI

`npm run lint && npm test && npm run build` is **not** what CI runs.

```
npm run typecheck && npm run lint && npm test && npm run build
npm ci --prefix apps/mobile-driver && npm run typecheck:mobile && npm run test:mobile
npm run security:env && npm run db:check-mirror
```

The last two a local run never touches.

## Never put mobile into a root script

`apps/mobile-driver` is an Expo app with its own lockfile, **not an npm
workspace**, so the root `npm ci` never installs its dependencies — CI installs
them later. Its tsconfig extends `expo/tsconfig.base`, which lives *inside*
`apps/mobile-driver/node_modules`, so `tsc` and `vitest` both fail before reading
a line of code.

This has caught three people. It always passes on a developer machine, which
already has that directory — **the one environment where the bug cannot reproduce
is the one where the change gets written.** `apps/web/lib/ci/root-scripts.test.ts`
now fails if anyone repeats it.

## Reproduce CI instead of guessing at it

```
git clone --depth 1 file://<repo> <scratch> && cd <scratch> && npm ci && npm run typecheck && npm test
```

Found the above in one run, after guessing had already burned a push.

## A test outside `lib/` never runs

`apps/web/vitest.config.ts` collects **`lib/**/*.test.ts` and nothing else**. A
test beside a component, an action, or the middleware does not fail — it is not
collected, which is worse than no test. Put the logic in `lib/`;
`lib/auth/public-paths.ts` and `lib/fleet-access/pin-rate-limit.ts` exist for that
reason. **After adding tests, check the vitest file count rose.**

## Pushing does not deploy

The Vercel project has **no Git connection** — verified by pushing and watching
sixteen minutes produce no deployment.

```
vercel --prod --yes        # from the repo root; project rootDirectory is apps/web
```

Confirm with `npm run smoke:production`, **not WebFetch** — it caches 15 minutes
per URL and will show you the previous build while you believe you shipped.

## Migrations before the code that needs them

`node scripts/apply-migrations.mjs --dry-run`, then `--yes`, then deploy. Then
**`node scripts/sync-supabase-migrations.mjs`** and commit the result —
`supabase/migrations/` is a generated mirror and CI fails `db:check-mirror` when
it drifts. Writing to the production database is gated by the permission
classifier; if it refuses, ask the owner rather than routing around it.

## Copy lives in `lib/i18n` or the page is not translated

The fleet page first shipped with 42 dictionary keys written *and bypassed* —
local `copy` tables beside a finished dictionary, two sets of translations for one
page, free to drift, with the dictionary looking complete to a reviewer.

## Reading the code is not checking the behaviour

Bugs that looked handled on inspection and were only found by building the state
and opening it: a driver scanning a valid QR for a unit with no work yet was told
the link was broken; the control room's park button had no rendering component at
all while the action behind it worked; and every GPS bug in §6.

If you are about to write "looks correct", open it instead.

## Issuing a link twice must not invalidate the first

Both link buttons originally minted a fresh token on every press, silently
revoking the one already printed and in someone's hand. The ordinary press must
**show** the live link; only an explicit reissue may replace it. Fixed twice.

## Rate limits key on the client, never on the token

Counting failed PINs against the token itself lets anyone who has seen the QR lock
the customer out by guessing badly on purpose. `pin-rate-limit.ts` keys on
`(token_id, client_fingerprint)` and never revokes the token.

## Environment

- **`pkill` does not kill Windows processes.** Use PowerShell `Stop-Process`, or a
  dead Metro holds port 8081 and `expo start` silently picks 8082.
- **`next start` reads only `apps/web/.env.local`** — `scripts/start-local-check.mjs`
  loads the root one.
- **`DRIVER_ACCESS_TOKEN_SECRET` differs between Vercel and `.env.local`**, so a
  locally seeded QR returns "ไม่พบงานสำหรับลิงก์นี้" against production. Issue
  test QRs from the deployment you intend to open them on.
- **`adb reverse` dies when the cable is unplugged**, and the symptoms look like
  an app failure. Re-run it before debugging anything else.
- **Heredocs and Python `\\` escapes do not survive this toolchain** — generated
  regexes came out as literal newlines twice. Use the Write tool for files
  containing escape sequences.

---

# 11. Guards in place

Do not delete these without understanding what each caught:

| Test / script | Stops |
|---|---|
| `lib/ci/root-scripts.test.ts` | mobile paths creeping back into root scripts |
| `lib/fleet-access/no-actions.test.ts` | the customer page gaining a mutation, or a hardcoded Thai string |
| `lib/auth/public-paths.test.ts` | `/fleet` and `/track` silently losing public access |
| `lib/fleet-access/pin-rate-limit.test.ts` | a lockout a stranger could trigger |
| `lib/data/fleet-view.test.ts` | driver phone numbers reaching a customer |
| `lib/domain/gps-freshness.test.ts` | the four GPS regressions in §6, using the measured gaps |
| `scripts/verify-one-unit-per-device.mjs` | one phone holding two units |
| `scripts/verify-unit-without-work.mjs` | a valid QR reading as broken |
| `scripts/verify-device-rebinding.mjs` | the PIN takeover path |
| `scripts/inspect-pings.mjs` | guessing about GPS |

---

# 12. Older notes

Folded into this one. Open only for history.

| | |
|---|---|
| `971` | the five findings from the three-device test — 1, 4, 5 done; 2 and 3 are §3.3–3.4 |
| `972` | bilingual reasoning — the live parts are §9 |
| `973` | the customer fleet view plan — fully delivered |
| `974` | previous handoff — emptied into this one |
| `975` | iOS readiness — the live parts are §5, minus what has since been done |
