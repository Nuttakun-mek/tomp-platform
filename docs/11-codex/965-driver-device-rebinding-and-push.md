# 965 — Device re-binding by PIN, and the push notification wiring

Handoff note. Two things changed that other agents will trip over if they assume
the old behaviour: **one QR is no longer permanently welded to one phone**, and
**push credentials now exist on the EAS side**.

Commit: `18eeb79`.

---

## 1. A driver can move a job to a new phone with the PIN

### The problem

`driver_access_tokens.metadata.deviceHash` binds a job to the first phone that
opens it. The check ran *before* the PIN check in all three code paths, so a
phone that had lost its device cookie — app reinstalled, storage cleared, phone
replaced, dev-client wiped during testing — was told "งานนี้ถูกเปิดใช้บนอุปกรณ์อื่นแล้ว"
and could never get as far as proving it knew the PIN.

The only remedy was issuing a new QR. That is worse than it sounds: a new token
means a second Mission Control card for the same driver, and the job history
stays attached to the abandoned one.

### What it does now

The QR and the PIN are **two independent factors**. Holding both is the same
proof of identity whichever phone you hold them on, so the order flipped:

1. lockout check
2. PIN check
3. binding follows whoever passed the PIN

`deviceBindPatch()` records the takeover in `metadata.deviceRebindings`
(`[{ from, at }]`, last 5 kept) so an operator can tell a genuine re-bind from a
routine unlock after the fact. **There is no UI for this yet** — if you are
building a token/QR admin panel, surface it there.

### The lockout, and why it is not a revoke any more

Letting any phone reach the PIN prompt opens a door the device check used to
keep shut: someone who scraped only the QR can now submit PINs. The old
behaviour — `status: 'revoked'` after 5 wrong tries — would have let them lock
the real driver out of their job with five guesses.

So five wrong PINs now set `metadata.pinLockedUntil = now + 15 min` and reset
the counter. The link is never revoked. Five tries per 15 minutes against a
6-digit PIN is not a guessing attack; a driver who fat-fingered theirs waits.

All of that arithmetic is in `apps/web/lib/domain/driver-pin-lock.ts`, pure and
tested (`driver-pin-lock.test.ts`, 14 cases). **Both** the Supabase path and the
raw-SQL path in `app/actions/driver-pin.ts` call it — if you touch one, touch
the other, they must not drift.

### Legacy tokens are still strict

A token with no `pinHash` (issued before the PIN feature) has no second factor,
so its device binding is all it has. Those still refuse a new phone and still
need a fresh QR. `apps/web/app/driver/page.tsx` says so in its own words rather
than sending the driver to a PIN prompt that cannot help them.

### New metadata keys on `driver_access_tokens`

| key | meaning |
|---|---|
| `pinLockedUntil` | ISO timestamp; PINs refused until then. Absent/past = open. |
| `deviceRebindings` | `[{ from: <old deviceHash>, at: <iso> }]`, last 5. |

`pinAttempts` still exists and still counts wrong tries inside the open window;
it is zeroed when the lock starts and when the cooldown lapses.

### Where the gate is decided

`apps/web/app/driver/page.tsx` computes `otherDeviceHolds` and renders
`<DriverPinGate takeover />`, which changes the copy to "ย้ายงานมาที่เครื่องนี้"
— a driver who reinstalled would otherwise read the standard prompt as a dead
end. `establishDriverSessionAction` accepts a mismatched binding **only** when
the token requires a PIN and this device holds a valid `dpin_<tokenId>` cookie,
i.e. it just cleared the gate.

---

## 2. Push notifications: credentials are in place

Expo needed an FCM V1 service-account key before any Android push could be
delivered. It is uploaded and attached:

- Expo app `@enexiss-team/tomp`, Android credentials `com.tomp.driver`
- `googleServiceAccountKeyForFcmV1` → `firebase-adminsdk-fbsvc@tomp-project.iam.gserviceaccount.com`

Done through the EAS GraphQL API (`createGoogleServiceAccountKey` +
`setGoogleServiceAccountKeyForFcmV1`) because `eas credentials` has no
non-interactive upload path. If you need to re-do it, that is the route — do not
send anyone to the dashboard.

**The private key must be rotated.** It was pasted into a chat transcript. It
lives outside the repo, and `.gitignore` now blocks `*service-account*.json`,
`tomp-project-*.json`, `fcm-key*.json` and `apps/mobile-driver/credentials.json`
so it cannot be swept in by `git add -A`.

`apps/mobile-driver/google-services.json` **is** committed (commit `cb545e7`).
Google documents that file as safe to commit — it holds no secret — but the
decision to keep it has not been confirmed by the owner.

### Delivery path

`sendDriverPush()` reads `driver_mobile_sessions.metadata.pushToken` for the
assignment's active sessions. A driver on an old build has no token there and
simply gets no banner — the notification row is written either way and the app
still polls, so nothing is lost but the banner.

---

## 3. Things a passing agent should not "fix"

- **`distanceInterval: 0` on both location watchers is deliberate.** Any positive
  value means "only report after moving N metres", which silently kills GPS for a
  parked driver and contradicts the 120s offline threshold in
  `lib/domain/gps-freshness.ts`. The movement filter lives in JS
  (`decideSend()` in `apps/mobile-driver/src/services/location.ts`), where an
  idle driver still heartbeats every 5 minutes flagged `metadata.idle = true`.
- **`GPS_IDLE_SECONDS = 390` is tied to that 5-minute heartbeat.** Change one and
  you must change the other, or a parked driver reads as "ขาดการอัปเดต".
- **`expo-intent-launcher` is required lazily** in `src/services/battery.ts`. A
  top-level import of a native module crashes any installed APK that predates it
  the moment Metro pushes new JS. Any new native module added mid-cycle wants the
  same treatment.
- **No `sound` field in `setNotificationChannelAsync`.** There, `sound` names a
  file in `res/raw`; passing `"default"` throws
  `Custom sound 'default' not found`.
