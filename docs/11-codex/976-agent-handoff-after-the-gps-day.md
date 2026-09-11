# 976 — Handoff: after the GPS day

**This replaces `974` as the entry point.** `974`'s pitfalls section still holds
and is still worth reading; its task list has moved on. `975` covers iOS and is
current.

Written 2026-09-11 at `e8d81a4`, at the end of a live test with real drivers.
Every number here came from the pings, not from reading the code.

---

## State

| | |
|---|---|
| working tree | clean |
| production | `2026.09.11.1958`, smoke 15/15 |
| Android APK **in drivers' hands** | the 19:35 build — **has the heartbeat bug below** |
| Android APK building | `beaea38c-6d47-453f-b8b7-35d7ec8baf06` — heartbeat fixed, **deliberately not distributed yet** |
| iOS | TestFlight 0.2.0 (2) — built **before** every GPS fix below |
| tests | 35 web files · 6 driver-core · 5 mobile |

The owner stopped the test to batch the remaining UI work with one final app
update, so **do not hand out a new APK until that work is done**. See "What to do
next".

---

# What happened today, and what it should teach you

Four rounds of GPS fixes went out. **Three of them were wrong**, and the pattern
is worth more than the fixes: each wrong one came from reasoning about how the
platform *should* behave, and each right one came from opening the data.

## Round 1 — parked drivers turning red

A unit went red while standing still. The pings:

```
gaps while moving:  32s, 32s, 32s, 32s   (like clockwork)
gaps once stopped:  175s, then 401s      (against a 180s limit)
```

Android defers background work once a device stops moving and the screen goes
off, foreground service or not. The heartbeat is only sent when the OS delivers a
location, so when the OS stops delivering, the heartbeat stops with it.

**The fix widened the window — and that was the wrong instinct.** See round 2.

## Round 2 — the fix that lied instead

Widening the window meant a unit nobody had heard from in ten minutes sat on the
board in the same calm blue as one reporting perfectly. The owner named it
immediately: *a long fuse before red is itself a deception, because everything
before it reads as a working connection.*

Worse, the allowance was keyed on the last ping's `idle` flag, which breaks in
traffic: a vehicle creeping forward more than `LOCATION_MOVED_METERS` sends that
ping as *moving*, so the deferral that follows is judged on the tight window.
Stop-and-go is the normal state of a Bangkok shift, not an edge case.

**Now:** three bands, keyed on the device reporting a cadence at all.

```
within cadence + 60s                     live / idle — believe the ping
until cadence + 60s + GPS_SLOW_GRACE     "สัญญาณช้า", amber — said the moment the link goes quiet
beyond that                              offline
```

The warning is what lets the final limit stay generous without deceiving anyone.
A long fuse only misleads when the states before it look fine. The grace is
measured from the end of the device's own fresh window, not a fixed clock — a
device promising a ten-minute heartbeat has a fresh window longer than a
ten-minute deadline, and a fixed deadline called it offline while it was still
keeping its word. The tests caught that.

## Round 3 — the position was wrong, and had "always been right before"

That last detail was the whole diagnosis. It had been right before: the web page
has always asked for `enableHighAccuracy`, and the drivers only moved to the app
that day.

The background task asked for `Accuracy.Balanced`, which resolves from cell
towers and wifi:

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
claims the vehicle is stationary — past `LOCATION_MOVED_METERS` of uncertainty
the ping goes without the `idle` flag, because it cannot prove what it was
asserting.

## Round 4 — the heartbeat was pinning moving vehicles in place

Reported as "the location does not move", then "it jumped". Both, three seconds
apart, twice:

```
12:53:56  heartbeat idle  13.880906,100.539708     12:53:59  foreground  13.875365,100.536094   (600m)
13:02:48  heartbeat idle  13.875365,100.536094     13:02:48  foreground  13.861176,100.533812   (1.6km)
```

Read the second pair carefully: the heartbeat re-sent **the exact coordinates
from nine minutes earlier**, stamped as current and flagged parked, in the same
second a real fix placed the vehicle 1.6km away.

This was mine, added that morning for the iOS parked case. The comment I wrote
said a heartbeat means "still here, as of this moment" — true while parked, a lie
the instant the vehicle moves, and the code had no way to tell which case it was
in. That is the whole problem with asserting something you did not check.

**Now:** the heartbeat asks. It runs only when one is due, requests a position
then, and sends what comes back with that fix's own timestamp. If it cannot get
one it sends nothing — silence reads as a slow signal and says so, where a stale
position dressed as a current one says the opposite of the truth.

**This fix is committed and built but not distributed.** The APK drivers are
holding still has it.

---

## The one thing still unexplained

Gaps of **321s, 346s, 529s** between sent pings, when the heartbeat should fire
every 120s. The timer itself was frozen, so the whole app was suspended — and
pings then arrived in bursts, several mechanisms landing in the same second as
everything thawed at once. `mode=background` pings stopped entirely after 12:48
while `foreground` and `heartbeat` continued, so the background task appears to
have died rather than been throttled.

The owner confirmed the obvious causes are **not** it:

- battery: **unrestricted**
- location: **allow all the time**
- the app's own status line: **GPS สด**

**Do not guess at this.** Three guesses were spent today and all three were
wrong. Reproduce it, watch `mode=background` specifically, and note that
`startBackgroundLocationSharing()` swallows its failure:

```ts
} catch {
  return false;   // no log, no reason, nothing to diagnose from
}
```

Making that failure say why it failed is probably the cheapest next step, and it
needs an app build, so fold it into the batch below.

---

# What to do next

The owner stopped testing to batch UI work with a single final app update. Do all
of this, then build once.

## 1. Show the age of every position

`relative-time-th.ts` already formats it. The board shows colour and nothing else,
so an operator cannot tell a position reported ten seconds ago from one reported
nine minutes ago.

This is the highest-value item on the list and it is small. **Every bug above
would have been caught hours earlier if the age were on screen** — a marker
claiming to be current while the driver reported being a kilometre away is
obvious the moment the card says "ล่าสุด 9 นาทีที่แล้ว", and invisible when it
only says blue. Colour says whether to worry; the number says what happened, and
a number cannot lie the way a colour can.

## 2. The Mission Control legend is wrong

`components/mission-control/live-location-map.tsx:179-181` hand-writes three rows
— green "< 35 วิ", amber "> 35 วิ", rose "> 2 นาที". Those thresholds stopped
applying when devices began reporting their own cadence, **"จอดอยู่" is missing
entirely** though blue markers appear, and today added a fourth state.

`components/fleet-view/fleet-legend.tsx` is the shape to copy: it generates rows
from the `GpsFreshness` values and `TRACKING_MARKER_COLORS`, so a state cannot
reach the map without reaching the legend. Delete the hand-written rows and drop
the numbers from the copy — they are not fixed properties of the system.

## 3. Check-in photo on the unit card

Finding 3 of `971`, still not started. `call-sign-access-panel.tsx` never receives
evidence. `getVehicleEvidenceByProjectId` returns it keyed by assignment and
`latestEvidenceByDriver` maps it to the driver; load it in
`app/(app)/assignments/page.tsx` alongside `observerLinks` and render a thumbnail.

## 4. Message sender colours

Finding 2 of `971`, still not started. `comms-console.tsx` styles inbound by
severity and outbound as one blue, so nothing says who is speaking. Reuse
`accentFor` from `call-sign-access-panel.tsx` and move severity to a left border.

## 5. Then build both platforms, once

```
eas build --platform android --profile preview    # APK, direct install
eas build --platform ios --profile production && eas submit --platform ios
```

Credentials are all stored now, so **both run non-interactively** — see `975`.
The iOS build on TestFlight predates every GPS fix above and must be replaced
before any iPhone driver uses it.

---

## The tool that found all of this

```
node scripts/inspect-pings.mjs                      # every unit active recently
node scripts/inspect-pings.mjs "ดอกไม้ แจกัน ริมธาร"   # one unit, ping by ping
```

It prints the gap between pings, the accuracy of each fix, whether the device
claimed to be standing still, and which band the board is showing. Fixes too
coarse to justify a "parked" reading are flagged.

**Run it before theorising.** Every correct diagnosis today came from it, and
every wrong one came from reasoning about the platform instead.

## Still true from `974`

Its "things that will bite you" section is unchanged and still worth reading:
green locally says nothing about CI, never put mobile paths in a root script,
reproduce CI in a clean clone, a test outside `lib/` never runs, pushing does not
deploy, WebFetch caches fifteen minutes, apply and mirror migrations before
shipping code that needs them, and copy lives in `lib/i18n` or the page is not
translated.

The bilingual rollout has not moved: **1,168 Thai literals across 114 `.tsx`
files**, one page converted. `972` has the order and the reasoning.
