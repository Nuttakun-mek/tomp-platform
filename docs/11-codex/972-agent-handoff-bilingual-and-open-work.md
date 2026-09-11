# 972 — Handoff: bilingual UI, and everything still open

Written 2026-09-11 at the close of the three-device test, for whoever picks the
work up next. Everything here is checked against the code as it stands at
`c95193a`, so the counts and file names are real rather than remembered.

---

## Read this first: deploying is not automatic

`git push origin main` does **not** deploy. The Vercel project has no Git
connection — `vercel project inspect` shows no Git section and no deployment
carries commit metadata. This was verified today by pushing and watching sixteen
minutes pass with no deployment created at all.

```
vercel --prod --yes          # from the repo root; project rootDirectory is apps/web
```

Then confirm what is actually live. `NEXT_PUBLIC_BUILD_TIME` is baked per build
by `apps/web/next.config.ts`, so `/api/health` returns a genuine build stamp — if
`version` does not move, the deploy did not happen. Earlier notes in this repo
claimed push auto-deploys; they were wrong, and any handoff that says so should
be disbelieved.

## What shipped today

- **One phone holds one unit.** Claiming a unit now releases that device from
  every other unit in the project. Found because ม้าน้ำ and หมูป่า were bound to
  the same device and their GPS traces sat on top of each other — the control
  room was watching a convoy of two that was one phone in one car.
  `scripts/verify-one-unit-per-device.mjs`, 4/4.
- **One send rule for both apps** (`packages/driver-core/src/location.ts`), and
  the heartbeat no longer writes every row twice.
- **Parking restored**, the bridge fall-through closed, and the waiting screen
  for a unit crewed before it has work.

---

# 1. Bilingual — the largest open item

The owner asked for every page to work in Thai and English. `969` laid the
foundation and stopped there; this section is what remains, measured.

## Where it actually stands

| | Thai strings in code | files |
|---|---|---|
| `apps/web` components and pages (`.tsx`) | 1,142 | 114 |
| `apps/web` actions, lib, API routes (`.ts`) | 713 | 78 |
| `apps/mobile-driver/src` | 38 | 9 |
| **in the dictionary today** | **~25 keys** | `th.ts` is 54 lines |

So the foundation exists and roughly one percent of the copy runs through it.
The switcher works, the cookie works, `?lang=` survives the driver redirect — but
every screen still renders Thai literals regardless of the setting. Switching to
English today changes the navigation labels and nothing else.

This is a large mechanical job. It should not be attempted in one pass, and it
should not be started at all until the three structural fixes below are done,
because without them each converted page can silently regress the others.

## Who actually needs English — reconsider the order

`969` proposed converting "dashboard, projects, assignments, Mission Control,
resources, driver" in that order. That is the order of how big the screens are,
not the order of who needs them.

The operators are Thai staff. The people most likely to need English are:

1. **The observer / passenger** — `app/track/[token]/page.tsx`. A foreign guest
   handed a QR to follow their vehicle. Twenty strings, one page.
2. **A non-Thai driver** — the driver surface, ~122 strings across nine files.
3. **Login and the error pages** — the first thing anyone sees, ~38 strings.

None of those three has a language switcher at all. `LanguageSwitcher` is
mounted only in `components/app-shell.tsx`, which the driver page, the track page
and the login page do not use. A guest opening `/track/<token>` has no way to
reach English even once the strings are converted — `?lang=` is the only route
in, and nobody hands out a URL with a query string on it.

**Recommended order:** track page → driver surface → login/errors → จัดงาน
(assignments) → ศูนย์ควบคุม (mission control) → resources → projects →
superadmin/dev-tools last, since only the vendor sees those.

## Three structural fixes before converting any page

**1. Derive the key type instead of hand-maintaining it.**
`I18nKey` in `lib/i18n/index.ts` is a hand-written union of 23 string literals.
At 1,900 strings that list is unmaintainable and will be abandoned halfway, which
loses the only compile-time check there is. Derive it:

```ts
type DeepKeys<T> = { [K in keyof T & string]: T[K] extends string ? K : `${K}.${DeepKeys<T[K]>}` }[keyof T & string];
export type I18nKey = DeepKeys<typeof th>;
```

**2. Make a missing English string a compile error.**
Type `en` as the same shape as `th` (`export const en: typeof th = { ... }`) so
adding a Thai key without its English twin fails `npm run typecheck`. Right now
`en.ts` is independent, so a missing key falls back to Thai silently and nobody
finds out until a guest is looking at it.

**3. Make a missing key loud in development.**
`t()` returns the key itself when the lookup fails — `"driver.waiting.title"`
rendered on the page. That is correct for production and invisible in review.
Render it as `⟦driver.waiting.title⟧` when `NODE_ENV !== "production"` so it
cannot be missed on the screen it is on.

## Rules that must hold

From `969`, and they still stand:

- Thai is the default. English is a display layer only.
- Do **not** translate database enums, API paths, permission keys, role keys,
  table or field names. `formatStatusTh` translates for display; the stored value
  stays as it is.
- Keep the operational English as it is: TOMP, Call Sign, QR, GPS, Google Maps.
- Switching language must not write a timeline event. It is a preference, not an
  operation.

## Server action errors

The 713 strings in `.ts` are mostly thrown error messages, and they cannot be
translated where they are thrown — the action does not know the locale, and the
string crosses a network boundary. Return a **message code** plus parameters and
resolve it in the component. `lib/actions/db-error.ts` is the place to start; it
already centralises the mapping.

Do this **after** the first two or three page groups, not before. The right set
of codes is obvious once a few pages have been converted, and invented wrong
otherwise.

## Guard it

Once a surface is converted, keep it converted. A lint rule or a test that greps
the converted directories for Thai literals and fails on a match costs an hour
and is the only thing that stops the next feature re-introducing them. Add each
directory to the guard as it is finished, so the guard grows with the work
instead of blocking it.

---

# 2. The five findings from the device test

Full detail in `971`. Each was traced to its cause; none is fixed.

| # | Finding | Cause | Size |
|---|---|---|---|
| 5 | The blue dot is never explained | the map has no legend; `idle` / "จอดอยู่" arrived with the heartbeat | small — generate it from `gpsFreshnessLabelTh` / `gpsFreshnessTone` so it cannot drift |
| 3 | The driver's check-in photo is missing from the unit card | `call-sign-access-panel.tsx` is never passed evidence; `getVehicleEvidenceByProjectId` and `latestEvidenceByDriver` already produce it | wiring only |
| 1 | Vehicles in the same yard read as one marker | `live-tracking-map.tsx` draws one `circleMarker` per point at exact coordinates | real work — spiderfy keeps each unit's colour and status, clustering is less code |
| 2 | Messages carry only two colours, so the sender is unclear | the console styles by severity; identity and severity compete for one channel | reuse `accentFor` from `call-sign-access-panel.tsx`, move severity to a left border |
| 4 | An issued QR cannot be shown again | the token exists **only as a hash**; the plaintext is genuinely gone | blocked — see the owner decision below |

Work that table top to bottom. The legend stops a question being asked every
time someone new looks at the board, and the photo is wiring.

---

# 3. Mobile

Nothing on the phone has been rebuilt since the source-level i18n changes in
`969`, so those are not on the test handset yet.

- **Every APK so far is the `development` profile** and needs Metro running on a
  developer machine. A real driver's phone cannot run that. `eas.json` already
  defines `preview` and `production`; this is a build, not a code change, and it
  blocks any rollout past the one test device.
- **iOS: `UIBackgroundModes: ["location"]` is missing from `infoPlist`.** iOS
  stops delivering location the moment the app leaves the foreground, which is
  the entire point of background GPS. Fix it before the first iOS build rather
  than debugging it afterwards.
- **iOS push needs an APNs key**, not the FCM service account. Separate upload,
  and it needs the Apple Developer account that is still pending.
- The 38 Thai strings in `apps/mobile-driver/src` need the same treatment as the
  web, but they are **native copy** — they ship in a binary or an EAS Update, not
  through Vercel. Group them with whatever native change goes out next.

---

# 4. Waiting on the owner

Decisions, not code. Each is cheap to answer and blocks work.

1. **Can the observer link be stored in plaintext?** It is read-only and carries
   no PIN, so holding it is far less risky than holding a driver credential, and
   it is the only way the passenger QR can be redrawn after a reload. Finding 4
   cannot start until this is answered. Recommendation: yes for the observer
   link, no for the driver token — the driver half gets an explicit "reissue"
   button that says plainly that it invalidates the printed sheet.
2. **Rotate the FCM service-account key.** The private key was pasted into a chat
   transcript on 2026-09-10 and must be considered disclosed. It works, so this
   is housekeeping — but it is not optional.
3. **Does `google-services.json` stay in git?** Google documents it as safe to
   commit and it holds no secret. A preference, not an incident. Either answer
   closes it.
4. **Align `DRIVER_ACCESS_TOKEN_SECRET` between Vercel and `.env.local`, or keep
   the split deliberately?** Nothing is broken either way; it only means a
   locally seeded QR can never be opened against production, which costs a
   testing session every time somebody forgets.
5. **Should the Vercel project be reconnected to GitHub** so pushes deploy? It
   would remove a manual step and a whole class of "I pushed, so it is live"
   mistakes.

---

# 5. Never tested on a real device

From the plan in `970`. Built and verified in scripts, but no handset has walked
them:

- Device takeover with the PIN — scan the same QR on a second phone, confirm the
  first stops being able to post.
- Notifications with the app backgrounded, and the launcher badge clearing when
  it is opened. Neither has been seen working on a device.
- The observer link in a plain browser: position and destination only, no
  controls, no passenger details.
- The waiting screen on a real handset, for a unit crewed before it has work.
- Background GPS parked for ten minutes with the screen off. If pings stop, get
  `adb logcat` before theorising — that is how the `RECEIVE_BOOT_COMPLETED` crash
  was found after three wrong guesses.

---

# 6. Verifying

```
npm run lint && npm test && npm run test:mobile && npm run build
```

`test:mobile` is separate on purpose: `apps/mobile-driver` is an Expo app with
its own lockfile, not an npm workspace, so the root `npm ci` never reaches it.
Folding it into `npm test` breaks CI — that was tried and reverted.

End-to-end guards, each against a seeded job, as all three clear the token
binding first:

```
node scripts/verify-device-rebinding.mjs    <base> <token> <pin>   # 20 checks
node scripts/verify-unit-without-work.mjs   <base> <token> <pin>   #  5 checks
node scripts/verify-one-unit-per-device.mjs <base> <tokenA> <pinA> <tokenB> <pinB>
```

After deploying: `npm run smoke:production` — 13 routes, 307 counts as a pass.

Two environment traps that have each cost an hour: `pkill` does not kill Windows
processes (use PowerShell `Stop-Process`, or a dead Metro holds port 8081 and
`expo start` silently picks 8082), and `next start` reads only
`apps/web/.env.local` — `scripts/start-local-check.mjs` exists to load the root
one.
