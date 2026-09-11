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

---

# Things that will bite you

**Moved to `976`**, which is now the single note to read. Nothing was dropped.
