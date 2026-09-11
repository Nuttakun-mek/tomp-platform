# 970 — Mobile test readiness

Written before resuming physical-device testing, which has not run since `965`.
Since then the web side was rebuilt twice — `967`/`968` moved the QR from a job
to a crewed unit and re-scoped resources, `969` added bilingual support — while
the mobile app barely changed. This is the review of that seam and the plan for
the test.

---

## The seam holds

Checked end to end rather than one side at a time.

| Link | State |
|---|---|
| Bridge protocol | `apps/mobile-driver/src/bridge/protocol.ts` re-exports `@tomp/driver-core` — no second copy to drift |
| Message types | Closed set in `parseBridgeMessage`; the native handler now names `gps.start` explicitly |
| Native status vocabulary | One `NativeStatus` union in `driver-core`; the web reads it through `parseNativeStatusDetail` |
| GPS payload | The API takes the assignment from the session, not the request body, so the app sends none and cannot send a stale one |
| QR parsing | `parseDriverLink` is token-shape agnostic, so the new `tomp_<callSignId>_…` works unchanged |
| Driver session | Carries `csid` and resolves the current job per request (`resolveDriverCurrentAssignment`) |

### Two bugs found and fixed while reviewing

**A valid QR read as a broken link.** Crewing a unit issues its QR immediately,
so a driver can hold a good printed sheet for a unit with no work yet — the
ordinary state of a new unit. The page answered `ไม่พบงานสำหรับลิงก์นี้`, which
would send them straight to the phone. It now separates "cannot use this token"
from "nothing to show yet" and says they are verified and waiting, with their
call sign and plate so they can check the sheet against the vehicle they are
standing next to. `scripts/verify-unit-without-work.mjs` covers it, 5/5.

Worth noting *how* it was found: the token resolver had already been taught
about call-sign scope, so reading the code it looked handled. It only appeared by
building that state and opening it.

**Parking a job had no button.** `ParkAssignmentButton` was rendered only by the
lane board, which `968` replaced — so the control room's escape hatch for a
driver stuck on a job that cannot be completed was unreachable while the action
behind it sat there working. Park and cancel now live on the status board in
ศูนย์ควบคุม, where job state is managed.

### One trap closed

Everything after the four named bridge cases used to fall through into
"start GPS". That stayed correct only because `parseBridgeMessage` rejects
unknown types — so the day someone adds a fifth message to the parser, every
older build would start GPS for it. The case is named now; an unknown message
does nothing.

---

## Before the test

1. Metro and the USB bridge:
   ```
   cd apps/mobile-driver && npx expo start --dev-client --port 8081
   adb reverse tcp:8081 tcp:8081
   ```
2. The app points at production (`TOMP_API_BASE_URL` default). Leave it there —
   the QR must come from the same deployment that hashed it.
3. **Issue the QR from production's own UI**, not a seeded one.
   `DRIVER_ACCESS_TOKEN_SECRET` differs between Vercel and `.env.local`, so a
   locally seeded QR returns "ไม่พบงานสำหรับลิงก์นี้" on production and the test
   dies at step one for a reason that has nothing to do with the app (`966`).
4. Current APK is the `development` profile and needs Metro. A `preview` build
   is what a real driver needs and is still outstanding (`966`).

---

## What to walk, in order

Everything below is new since the last device run. None of it has been seen on a
real handset.

**1 — Crew a unit and hand it over.** จัดงาน → ขั้นที่ 1. Watch that both QR
codes and the PIN appear on the unit's own card. Save the combined image and the
print/PDF: the PIN is shown once and is stored only as a hash.

**2 — Scan before there is any work.** This is the fix above. Expect the PIN
gate, then "ยืนยันตัวเรียบร้อย รอรับงาน" with the right call sign and plate.
A broken-link message here means the fix regressed.

**3 — Open work and refresh.** Dispatch adds a job in ขั้นที่ 2; the driver's
screen should move from waiting to the job.

**4 — GPS.** Share, confirm Mission Control shows the driver live, then put the
phone down with the screen off. **The heartbeat is now 2 minutes, not 5** — a
parked driver should read "จอดอยู่" in blue and never turn amber or red. If it
does, the cadence and `GPS_HEARTBEAT_SLACK_SECONDS` have drifted apart.

**5 — Background.** Leave it parked 10+ minutes with the screen off. Pings should
keep arriving. If they stop, get `adb logcat` before theorising — that is how the
`RECEIVE_BOOT_COMPLETED` crash was found after three wrong guesses.

**6 — Notifications.** Send from ศูนย์ควบคุม with the app backgrounded. The
banner should arrive, and the launcher badge should clear when the app is opened
— neither has been seen working on a device.

**7 — Move the job to a second phone.** Scan the same QR on another handset and
enter the PIN. It should transfer, and the first phone should stop being able to
post anything.

**8 — Observer link.** Open it in a plain browser. Position and destination only,
no controls, no passenger details.

---

## Watch for

- **The waiting screen has no GPS controls**, so `DriverLocationShare` does not
  mount there. That is correct — there is nothing to attach a position to — but
  it means GPS cannot be started until a job exists.
- **A driver API call with no current job returns 404**, not 500, with a Thai
  message. Expected while waiting.
- **`adb reverse` dies when the cable is unplugged.** Symptoms look like an app
  failure. Re-run it before debugging anything else.
- **`pkill` does not kill Windows processes.** Use PowerShell `Stop-Process`, or
  a dead Metro will hold port 8081 and `expo start` will silently pick 8082.

---

## Verifying before the run

```
npm run lint && npm test && npm run test:mobile && npm run build
```

`npm run test:mobile` is separate on purpose: `apps/mobile-driver` is an Expo app
with its own lockfile, not an npm workspace, so the root `npm ci` never reaches
it. Folding it into `npm test` breaks CI — that was tried and reverted.

End-to-end guards, each against a seeded job only, as both clear the token's
binding first:

```
node scripts/verify-device-rebinding.mjs  <base> <token> <pin>   # 20 checks
node scripts/verify-unit-without-work.mjs <base> <token> <pin>   # 5 checks
```
