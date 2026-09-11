# 971 — Findings from the three-device test

Raised by the owner while running one native driver (USB) and two web drivers
against production. Recorded now, to be worked after the test is closed and
summarised.

Each item below was checked against the code, so the cause is known rather than
guessed — but none is fixed yet.

---

## Already fixed during the session

Two came out of the ping intervals rather than the screen, so they are done:

- **Every heartbeat wrote two rows.** `decideSend` read `lastSent`, awaited the
  network, and wrote it back only on success, so the foreground and background
  watchers both saw the same heartbeat as due. The gaps read `121, 0, 122, 0`.
  The slot is claimed before the request now, and handed back if it fails.
- **The web page had no send rule at all.** It posted every `watchPosition`
  callback — one to seven seconds apart — and sent no cadence, so a web driver
  was judged on the browser-tuned 35s/120s scale and turned red the moment the
  screen locked. Both apps now call one rule in `@tomp/driver-core`.

---

## 1. Markers on top of each other read as one vehicle

`live-tracking-map.tsx` draws one `circleMarker` per point at its exact
coordinates. Vehicles parked in the same yard land on the same pixel, so five
units look like one and the count on the card disagrees with the map.

Worth noting the map is the one place where "how many are here" is asked
visually, so the honest fix is not a tooltip. Either spiderfy the overlapping
group — fan them out on a small radius with a leader line — or cluster with a
count badge that expands on click. Clustering is less code; spiderfying keeps
each unit's own colour and status visible, which matters more here than a count.

## 2. Messages carry only two colours, so the sender is unclear

The console styles inbound by *severity* (rose / amber / slate) and outbound as
one blue. With several drivers in one thread there is nothing that says which
unit a message came from at a glance — severity and identity are competing for
the same channel.

The unit cards already solved this: each call sign has a stable colour derived
from its name (`accentFor` in `call-sign-access-panel.tsx`). Reusing it here
would make a message recognisable by the same colour the operator already
associates with that vehicle. Severity then needs a different channel — a left
border or an icon — rather than the fill.

## 3. The driver's check-in photo is missing from the unit card

Confirmed: `call-sign-access-panel.tsx` never receives evidence at all. It is
loaded on Mission Control (`fleet-board`) and on the vehicle task card, but the
unit card in จัดงาน — which is where an operator looks at a specific unit — was
built without it.

The data is ready: `getVehicleEvidenceByProjectId` returns it keyed by
assignment and `latestEvidenceByDriver` already maps it to the driver, so this
is passing it down and rendering a thumbnail, not new plumbing.

## 4. An issued QR cannot be shown again

This one has a constraint that has to be decided rather than coded around.

The QR is a token that exists **only as a hash** (`driver_access_tokens.token_hash`).
The plaintext is shown once and never stored, so a page refresh genuinely cannot
redraw it — there is nothing left to draw. Same for the PIN. The card keeps
`issued[callSignId]` in memory for the session, which is why it disappears on
reload, and why only the half that was just issued appears when the driver QR
and the observer link are created at different moments.

Three ways out, in order of how much they give up:

1. **Reissue on demand** — a "แสดง QR อีกครั้ง" button that revokes and issues a
   fresh one. Honest and already supported, but invalidates a printed sheet, so
   it must say so.
2. **Store the observer link in plaintext** and keep only the driver token
   hashed. The observer link is read-only and carries no PIN, so the risk of
   holding it is much lower than for the driver credential. That would let the
   passenger QR always redraw, and only the driver half need reissuing.
3. **Store both in plaintext.** Convenient and the only option that makes the
   card fully reloadable — and it means a database read hands someone a working
   driver credential. Not recommended.

Recommendation: (2), plus making the "issued once" wording on the sheet
unmissable so nobody expects otherwise.

## 5. The blue dot is never explained

`idle` / "จอดอยู่" is the state introduced with the heartbeat, and the map has
no legend at all. An operator sees a colour nobody has defined for them and has
to guess whether blue is better or worse than green.

The full set needs saying somewhere near the map: live, จอดอยู่, สัญญาณช้า,
ขาดการอัปเดต, หยุดแชร์. The labels and tones already exist in
`lib/domain/gps-freshness.ts` — `gpsFreshnessLabelTh` and `gpsFreshnessTone` —
so a legend can be generated from them rather than hand-written, which keeps it
from drifting when a state is added.

---

## Suggested order

1. **(5) Legend** — smallest, and it stops the blue dot being a question every
   time someone new looks at the board.
2. **(3) Photo on the unit card** — data is ready, only wiring.
3. **(1) Overlapping markers** — real work, but it is the map lying about how
   many vehicles are somewhere, which is the map's whole job.
4. **(2) Message colours** — reuse the call sign colour; move severity to
   another channel.
5. **(4) QR redisplay** — needs the owner's decision on storing the observer
   link in plaintext before any code.
