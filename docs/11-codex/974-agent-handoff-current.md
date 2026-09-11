# 974 — Handoff: what to do next, and what will bite you

> **Superseded by `976`.** A day of live testing with real drivers changed the
> task list and found four GPS bugs, three of them introduced while fixing the
> previous one. The "things that will bite you" section below is unchanged and
> still worth reading; for what to do next, start at `976`.

`972` and `973` are still accurate about *why* things are the way they are, but
`973`'s tasks are all done and `972`'s counts have moved.

Written 2026-09-11 against `fb0fa30`. Every number below was measured, not
remembered.

---

## Where things stand

Verified today, not assumed:

| | |
|---|---|
| working tree | clean |
| CI | run 92 green — both `verify` and `database` |
| production | `2026.09.11.1522`, smoke 15/15 |
| migrations | 0001–0038 applied; `supabase/migrations` mirror in sync |
| tests | 194 web · 29 driver-core · 19 mobile · no skips |
| lint | clean, no warnings |

So the repo is **clean and green**. It is **not finished**, and the gap is mostly
translation plus things no handset has ever done.

## Done since `971`, so you do not redo it

- **QR redisplay.** The observer link is stored in plaintext and redraws on every
  load; the driver token stays hash-only. The sheet says which is which and
  warns, until it has actually been saved, that the driver QR and PIN appear
  once (`0036`, `1f0b33f`).
- **Customer fleet view.** `/fleet/<token>` — project-wide, read-only, optional
  PIN, optional call-sign subset, driver names off by default, phones never.
  Plan `973`, all ten tasks.
- **Overlapping map markers** — finding 1 of `971` (`c423243`).
- **GPS ping idempotency** — retries no longer double-write (`0038`, `4113f31`).
- **One phone holds one unit** (`c95193a`).

## The five findings from `971`, as they actually stand

| # | | |
|---|---|---|
| 1 | overlapping markers | **done** |
| 4 | QR redisplay | **done** |
| 5 | blue dot unexplained | **half done — see below** |
| 3 | check-in photo on the unit card | **not started** |
| 2 | message sender colours | **not started** |

---

# What to do next, in order

## 1. The Mission Control legend is wrong (small, do it first)

`components/mission-control/live-location-map.tsx:179-181` hand-writes three
rows:

```
green   กำลังแชร์ (< 35 วิ)
amber   สัญญาณช้า (> 35 วิ)
rose    ขาดการอัปเดต (> 2 นาที)
```

Two problems. **Blue / "จอดอยู่" is missing entirely**, though blue markers do
appear — which is finding 5, still open for the operator even though the customer
page got its legend. And the 35s/120s thresholds **no longer apply** to any
device that reports its own cadence, which is every current build; the legend is
teaching the control room a rule the system stopped using.

`components/fleet-view/fleet-legend.tsx` is the shape to copy: it generates rows
from the five `GpsFreshness` values and `TRACKING_MARKER_COLORS`, so a new state
cannot reach the map without reaching the legend. Do the same here and delete the
hand-written rows. Drop the numeric thresholds from the copy — they are not a
fixed property of the system any more.

## 2. Check-in photo on the unit card (wiring only)

Finding 3. `components/assignments/call-sign-access-panel.tsx` never receives
evidence — `grep -c evidence` returns 0. The data already exists:
`getVehicleEvidenceByProjectId` returns it keyed by assignment and
`latestEvidenceByDriver` maps it to the driver. Load it in
`app/(app)/assignments/page.tsx` alongside `observerLinks`, pass it down, render
a thumbnail. No new plumbing.

## 3. Message sender colours

Finding 2. `comms-console.tsx` styles inbound by severity and outbound as one
blue, so with several drivers in a thread nothing says who is speaking. Reuse
`accentFor` from `call-sign-access-panel.tsx` — each call sign already has a
stable colour derived from its name, and the operator already associates it with
that vehicle. Severity then needs a different channel: a left border or an icon,
not the fill.

## 4. The translation rollout — the big one

**Measured today: 1,168 Thai literals across 114 `.tsx` files, plus 107 `.ts`
files.** One page (`/fleet`) is fully converted. That is the state.

The order, and the reason for it, is in `972`: convert by **who cannot read the
screen**, not by screen size. Operators are Thai staff. The people who need
English are the observer (`app/track/[token]`), a non-Thai driver, and anyone on
the login and error pages — and **none of those mounts `LanguageSwitcher`**,
which lives only in `components/app-shell.tsx`. Converting the strings without
adding the switcher leaves `?lang=` as the only way in, and nobody hands out a URL
with a query string.

Order: `track` → driver surface → login/errors → จัดงาน → ศูนย์ควบคุม →
resources → projects → superadmin last.

The structural work is already done and working: `I18nKey` is derived from the
`th` dictionary, `en` is typed against it so a missing translation fails
`typecheck`, and `t()` renders `⟦some.key⟧` in development when a key is missing.
Use them.

**Also fix `/track` while you are in it.** It shows coordinates as text with a
Google Maps link and draws no map at all — poor for the passenger it exists for.
`LiveTrackingMap` is right there.

## 5. Server action error message codes

The 107 `.ts` files are mostly thrown Thai error strings, which cannot be
translated where they are thrown — the action does not know the locale.
`app/actions/fleet-pin.ts` already demonstrates the pattern: return a code, and
resolve it against the dictionary in the component (`fleet-pin-gate.tsx` maps
them). Extend from `lib/actions/db-error.ts`. Do this **after** two or three page
groups, not before — the right set of codes is obvious by then and invented wrong
now.

## 6. Never tested on a real handset

Built and covered by scripts, walked by no phone: device takeover with the PIN ·
notifications with the app backgrounded and the launcher badge clearing · the
observer link in a plain browser · the waiting screen for a unit crewed before it
has work · background GPS parked ten minutes with the screen off.

If background pings stop, get `adb logcat` **before** theorising — that is how
the `RECEIVE_BOOT_COMPLETED` crash was found after three wrong guesses.

## 7. Blocked on the owner

1. **Rotate the FCM service-account key.** Pasted into a chat transcript
   2026-09-10, so treat it as disclosed. It works; rotation is housekeeping, but
   not optional.
2. **`google-services.json` in git?** Google documents it as safe to commit and
   it holds no secret. Preference, not incident.
3. **Align `DRIVER_ACCESS_TOKEN_SECRET` between Vercel and `.env.local`?**
   Nothing breaks either way; it only means a locally seeded QR can never be
   opened against production.
4. **Reconnect Vercel to GitHub?** Would remove a manual step and a whole class
   of "I pushed, so it is live".
5. **`preview` APK** — every build so far is `development` and needs Metro on a
   developer machine. Blocks any rollout past the one test handset.
6. ~~**iOS `UIBackgroundModes`** is missing from `infoPlist`.~~ **Wrong — it is
   generated by the expo-location plugin at prebuild.** See `975` for the iOS
   work that is actually needed.

---

# Things that will bite you

Every one of these cost real time in this session. They are not hypotheticals.

## Green locally means nothing about CI

`npm run lint && npm test && npm run build` is **not** what CI runs. Verify also
runs `typecheck`, `typecheck:mobile`, `test:mobile`, `security:env` and
`db:check-mirror` — and the last two a local run never touches at all.

The full sequence:

```
npm run typecheck && npm run lint && npm test && npm run build
npm ci --prefix apps/mobile-driver && npm run typecheck:mobile && npm run test:mobile
npm run security:env && npm run db:check-mirror
```

## Never put mobile into a root script

`apps/mobile-driver` is an Expo app with its own lockfile, **not an npm
workspace** (`workspaces` is `apps/web` + `packages/*`), so the root `npm ci`
never installs its dependencies — CI installs them in a later step. Its tsconfig
extends `expo/tsconfig.base`, which resolves *inside*
`apps/mobile-driver/node_modules`, so both `tsc` and `vitest` fail before reading
a line of code.

This has caught three people: `5aa2110` folded the mobile tests into root `test`,
`736dd1f` undid it, `4113f31` put back **both** that and the same for
`typecheck`. Every time it passed locally, because a developer machine already
has `apps/mobile-driver/node_modules` from the last time someone ran the app —
**the one environment where the bug cannot reproduce is the one where the change
gets written.**

`apps/web/lib/ci/root-scripts.test.ts` now fails if anyone does it again.

## Reproduce CI instead of guessing at it

When something passes locally and fails on CI, stop editing and reproduce:

```
git clone --depth 1 file://<repo> /tmp/cirepro && cd /tmp/cirepro
npm ci && npm run typecheck && npm test
```

This found the above in one run after a round of guessing had already burned a
push.

## A test outside `lib/` never runs

`apps/web/vitest.config.ts` collects **`lib/**/*.test.ts` and nothing else**. A
test written beside a component, an action, or the middleware does not fail — it
is not collected, which is worse than having no test. Put the logic in `lib/` and
test it there; `lib/auth/public-paths.ts` and `lib/fleet-access/pin-rate-limit.ts`
exist precisely so middleware and action logic could be tested.

After adding tests, **check the file count in the vitest output went up.**

## Pushing does not deploy

The Vercel project has **no Git connection** — verified by pushing and watching
sixteen minutes produce no deployment. Deploy with:

```
vercel --prod --yes        # from the repo root; project rootDirectory is apps/web
```

Confirm with `npm run smoke:production`, not WebFetch — **WebFetch caches 15
minutes per URL** and will happily show you the previous build and let you
believe you shipped.

## Apply the migration before deploying the code that needs it

Code that writes a new column fails on every call until the column exists. Order
is always: `node scripts/apply-migrations.mjs --dry-run`, then `--yes`, then
deploy. Then **`node scripts/sync-supabase-migrations.mjs`** and commit the
result — `supabase/migrations/` is a generated mirror and CI fails
`db:check-mirror` when it drifts. Forgetting this broke run 90.

Writing to the production database is gated by the permission classifier. If it
refuses, ask the owner rather than routing around it.

## Copy lives in `lib/i18n` or the page is not translated

The fleet page first shipped with 42 dictionary keys written *and bypassed* —
local `copy` tables in the components beside a finished dictionary, two sets of
translations for one page, free to drift, with the dictionary looking complete to
anyone reviewing it. `lib/fleet-access/no-actions.test.ts` now fails on any Thai
character under `components/fleet-view/` or `app/fleet/`.

**Extend that guard to each surface as you convert it.** A guard that grows with
the work is the only thing that stops the next feature reintroducing literals.

## Reading the code is not checking the behaviour

Two bugs this session looked handled on inspection and were only found by
building the state and opening it: a driver scanning a valid QR for a unit with
no work yet was told the link was broken, and the control room's park button had
no rendering component at all while the action behind it worked fine.

If you are about to write "looks correct", open it instead.

## Issuing a link twice must not invalidate the first

Both link buttons originally minted a fresh token on every press, silently
revoking the one already printed and in someone's hand. The ordinary press must
**show** the live link; only an explicit reissue may replace it. This was fixed
twice — once for the unit link, once for the project link where ticking "use a
PIN" bypassed the check.

## Rate limits key on the client, never on the token

Counting failed PINs against the token itself lets anyone who has seen the QR
lock the customer out by guessing badly on purpose. `pin-rate-limit.ts` keys on
`(token_id, client_fingerprint)` and **never** revokes the token; a test asserts
the token is still active after twenty failures. Keep it that way.

## Environment

- **`pkill` does not kill Windows processes.** Use PowerShell `Stop-Process`, or
  a dead Metro holds port 8081 and `expo start` silently picks 8082.
- **`next start` reads only `apps/web/.env.local`.** `scripts/start-local-check.mjs`
  exists to load the root one.
- **`DRIVER_ACCESS_TOKEN_SECRET` differs between Vercel and `.env.local`**, so a
  locally seeded QR returns "ไม่พบงานสำหรับลิงก์นี้" against production. Issue
  test QRs from the deployment you intend to open them on.
- **`adb reverse` dies when the cable is unplugged** and the symptoms look like an
  app failure. Re-run it before debugging anything else.
- **Heredocs and Python `\\` escapes do not survive this toolchain** — generated
  regexes came out as literal newlines twice. Use the Write tool for any file
  containing escape sequences.

---

## Guards currently in place

Do not delete these without understanding what each one caught:

| Test | Stops |
|---|---|
| `lib/ci/root-scripts.test.ts` | mobile paths creeping back into root scripts |
| `lib/fleet-access/no-actions.test.ts` | the customer page gaining a mutation, or a hardcoded Thai string |
| `lib/auth/public-paths.test.ts` | `/fleet` and `/track` silently losing public access |
| `lib/fleet-access/pin-rate-limit.test.ts` | a lockout that a stranger could trigger |
| `lib/data/fleet-view.test.ts` | driver phone numbers reaching a customer |
| `scripts/verify-one-unit-per-device.mjs` | one phone holding two units |
| `scripts/verify-unit-without-work.mjs` | a valid QR reading as broken |
| `scripts/verify-device-rebinding.mjs` | the PIN takeover path |
