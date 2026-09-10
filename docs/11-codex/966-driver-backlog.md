# 966 — Driver app backlog

Work agreed but deliberately not built yet, from the on-device testing session
on 2026-09-10. Each entry says what was decided, so whoever picks it up does not
have to re-run the conversation.

Anything fixed during that session is not here — see `965` for the device
re-binding and push wiring, and the commit log for the rest.

---

## 1. Remind the driver before their next job starts

**Status:** agreed, parked by the owner. Build it when the queue clears.

The driver should be told their next job is coming up before it starts.

**The lead time is configurable — not a hard-coded 10 minutes.** The owner asked
for 10 minutes as the default and then specifically asked that the interval be
settable, so build the setting first and let 10 minutes be its default value.
Where the setting lives (per project, per driver, or both) is open; per project
is the smaller change and matches how the rest of the operation is scoped.

### The delivery decision that has to be made first

Two mechanisms, and the choice is not cosmetic:

| | schedule it on the phone | send it from the server (cron) |
|---|---|---|
| driver has no signal | still fires | never arrives |
| dispatch moves the job time | stale until the app next syncs | always current |
| proof it was sent | none | a row you can audit |
| infrastructure | none | cron + de-duplication |

`expo-notifications` can schedule a local notification that fires with the app
closed, so the phone-side option is real, not a fallback. The trap is the stale
schedule: every sync has to cancel and re-register the reminders, or a driver
gets pinged for a job that moved.

Doing both is defensible — local as the primary so it works without signal,
cron as the backstop — but only with a shared idempotency key, or the driver
gets two banners for one job. The platform already has `sendDriverPush()` and a
working FCM path, so the server half is the smaller piece of work.

### What it needs from what already exists

- The job order and "which one is next" are already decided in
  `apps/web/lib/domain/driver-day-order.ts` — `isNext` is exactly the job to
  remind about. Do not re-derive it.
- `assignments.start_time` is the time to count back from.
- A reminder must not fire for a job that is already `active`, `completed` or
  `cancelled`.

---

## 2. Rotate the FCM service-account key

**Status:** required, owner action.

The private key was pasted into a chat transcript on 2026-09-10, so it must be
considered disclosed. It is uploaded and working
(`firebase-adminsdk-fbsvc@tomp-project.iam.gserviceaccount.com`, attached to
`com.tomp.driver`), so rotation is housekeeping rather than an outage — but it
is not optional.

Regenerate in Google Cloud, then re-upload through the EAS GraphQL API
(`createGoogleServiceAccountKey` + `setGoogleServiceAccountKeyForFcmV1`);
`eas credentials` has no non-interactive path. `965` has the details.

---

## 3. Decide whether `google-services.json` stays in git

**Status:** waiting on the owner.

It went in with commit `cb545e7` via `git add -A`. Google documents the file as
safe to commit and it holds no secret, so this is a preference, not an incident.
Say either way and the question closes.

---

## 4. `DRIVER_ACCESS_TOKEN_SECRET` differs between Vercel and `.env.local`

**Status:** understood, decide whether to align them.

Proven on 2026-09-10: a QR seeded from a developer machine resolves against a
local server and returns "ไม่พบงานสำหรับลิงก์นี้" on production, against the
same database. Both secrets are real; they are simply different values.

Nothing is broken by this — a QR issued by production is hashed with
production's secret and works there. It only means **a locally seeded test QR
can never be opened against production**, which costs a testing session every
time someone forgets. Either align the values or keep the split deliberately and
seed test jobs against whichever deployment will open them.

---

## 5. Build profile for a real rollout

**Status:** blocking any rollout beyond the test handset.

Every APK so far is the `development` profile, which needs Metro on a developer
machine to serve the JS bundle. A driver's phone cannot run that. A `preview` or
`production` build embeds the bundle and stands alone; `eas.json` already
defines both profiles, so this is a build, not a code change.

Worth pairing with any native-side UI change, since those need a reinstall
anyway — see `965` for which parts of the driver UI are native and which are web
(the web parts deploy through Vercel and need no new APK).
