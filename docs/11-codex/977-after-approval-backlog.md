# 977 — What to build next, after TestFlight approval

Opened 2026-09-16 from the owner's field notes. Live list: expect updates.
`976` is still the handoff for how the platform fits together and what bit us
during the GPS day; this file is only the work that came after it.

---

# 0. Where things stand

| | |
|---|---|
| iOS build 3 (0.2.0) | **APPROVED** — the public link works, invites and redeem codes reach testers |
| iOS build 4 (0.2.0) | uploaded, in the external group, **not submitted for review yet** |
| Android | APK versionCode 3, same commit as build 4, QR issued |
| Public link | https://testflight.apple.com/join/sEBdykSK |

**Submit build 4 now.** Apple refuses two builds of one version train at once —
`422 Another build in the same train is already in beta review` — which is why
it could not go earlier. That block is gone now that build 3 has cleared.
Build 4 carries the iOS "สแกน QR ใหม่" reset, the new shell UI, and `appBuild`
on every ping; drivers should be on it, not on build 3.

Cleanup that is now safe, and only now: the Apple reviewer's demo job
(`scripts/seed-driver-flow-test.mjs --purge`, plus the token whose expiry was
pushed to 2026-09-28). Do not purge before build 4 is approved too — the same
demo job is what a reviewer opens.

---

# 1. The project-wide tracking QR is dead on arrival ← fix first

**Reported:** the QR for "watch the whole project" cannot be opened.

**Root cause, from the data.** `apps/web/app/actions/observer-access.ts`:

```ts
function defaultProjectExpiry(endDate: string | null | undefined) {
  if (endDate) { ...; value.setDate(value.getDate() + 1); return value.toISOString(); }
  return getDefaultDriverTokenExpiry(24 * 30);
}
```

A project-scope link expires one day after the project's `end_date` — with no
check that the date is in the future. Production on 2026-09-15 08:47 holds eight
project tokens created within two minutes, every one of them stamped
`expires_at = 2026-09-13 07:00`: **expired before the operator finished reading
the screen.** `getFleetViewByToken` (`apps/web/lib/data/fleet-view.ts:104,170`)
drops an expired token and the page renders "access denied", which is exactly
what was seen.

The burst of eight is the same bug feeding itself: the action reuses a live
token, an expired one does not qualify, so every press mints another link that
is also already dead.

**Fix**
- Never issue an expiry in the past: `max(end_date + 1 day, now + 7 days)`, or
  fall back to the 30-day default when the project has already ended.
- Say the expiry out loud in the issue dialog, and let the operator change it —
  the schema already accepts `expiresAt`.
- The eight dead rows are litter: mark them `status = 'revoked'` so the next
  issue does not have to skip them.

**Guard:** a unit test over `defaultProjectExpiry` — a project that ended
yesterday must still produce a future expiry. Nothing in `lib/data` needs to
change; the lookup is correct, it was told a lie.

---

# 2. Resources prepares the pair; the management page forms the unit

**Decided with the owner 2026-09-16.** An earlier draft of this section had the
QR moving to the resources tab. That was wrong and is corrected here: **the call
sign and the QR are created on the management page**, which is also where they
live today.

**Already true — do not rebuild it**
- `components/assignments/call-sign-access-panel.tsx` issues the driver QR and
  the observer QR per call sign, renders them, and handles revoke, redisplay and
  PIN. The management page is already the place credentials come from.
- `updateCallSignCrewAction` (`app/actions/call-signs.ts:35`) already writes a
  `call_sign_crew_events` row **and** a timeline event when a driver or vehicle
  is swapped. Swapping keeps the same call sign. Nothing to add.

**What changes**

1. **Resources tab (`/resources?projectId=…`) — bring people and vehicles in as
   a set.** One action creates a driver and a vehicle together rather than two
   visits to two forms, and importing from the central library brings a person
   and a vehicle across together. Record the intended pairing in the copies'
   existing `metadata` jsonb (`pairedVehicleId` on the driver, `pairedDriverId`
   on the vehicle) — **no migration needed**. A pair here is a prepared
   suggestion, not yet a unit.

2. **Management page — show what is prepared, then form the unit.** List every
   prepared pair, both the ones created inside the project and the ones imported
   from outside, with the driver's name and phone, the plate and vehicle type,
   and whether each side is still free. Forming the unit is
   `createCallSignAction` from that pair; the QR follows from the panel that
   already exists. This is the screen where a dispatcher decides, so this is
   where the unit and its credentials are born.

3. **Stop the one button that does four things.**
   `components/assignments/unit-setup-form.tsx` currently creates a mission, a
   call sign, a driver token and an observer token in a single submit
   (lines 99, 154, 173). Forming a unit and planning work are different
   decisions: unit formation stays here, **mission creation moves to its own
   step.**

**Constraints this respects**
- `call_signs.project_id` is required, so a unit cannot exist in the central
  library — which is exactly why pairing at the resources stage is a suggestion
  and the call sign is only formed once a project is in hand.
- Library rows are **copied** into a project (`source_driver_id` /
  `source_vehicle_id`, status reset to available); the partial unique index from
  migration `0035` refuses a second copy of the same source.

**Guard:** a test that nothing under `components/resources/` imports
`createCallSignAction`, `createDriverAccessTokenAction` or
`createObserverAccessTokenAction` — the resources tab prepares, it does not
issue. Same shape as `lib/fleet-access/no-actions.test.ts`, which exists because
a split like this grows back quietly.

---

# 3. Photos in the central comms thread, both directions, stamped

**Asked for:** a driver can send a photo in the chat with the control room, the
photo carries the capture time and coordinates drawn on it, **the control room
can send photos back**, and this lives in the central communications area. Photos
here are **a separate system from check-in photos** — separate bucket, separate
route, separate record.

**This is almost entirely web work.** The native shell only hosts the page in a
WebView; see "Native impact" at the end.

## Where it lives today

| direction | path |
|---|---|
| driver → control | `driver-task-view.tsx::sendMessage` → `driverIssueReportAction` → `driver_issue_reports` |
| control → driver | `/mission-control` → `comms-console.tsx` → `sendDriverNotificationAction` → `driver_notifications`, and it already fires `sendDriverPush` |
| driver reads both | `driver-chat-thread.tsx::buildBubbles(messages, notifications)` |

## WEB — the work

**Storage**
1. Migration **`0039`**: new private bucket **`driver-message-photos`**, 10 MB,
   same mime list as `0023`, policies copied from `0009`. Do **not** reuse
   `driver-evidence` (that is check-in), and do **not** adopt the orphan
   `driver-checkin-photos` bucket that exists with no code behind it.

**Shared helpers (new)**
2. `lib/images/compress.ts` — lift `compressImage` out of
   `driver-photo-check.tsx` so both features share the technique without sharing
   a pipeline. Pass `imageOrientation: "from-image"` to `createImageBitmap`, or a
   photo taken sideways gets a sideways stamp.
3. `lib/images/stamp.ts` — draw `เวลา · พิกัด` onto the canvas before upload.

**Upload routes (new, one per side — the two callers authenticate differently)**
4. `app/api/driver/message-photo/route.ts` — driver side, token-authed exactly
   like `api/driver/evidence`, project and assignment taken from the token.
5. `app/api/mission-control/message-photo/route.ts` — control-room side, session
   authed, and it **must call `requirePermission(projectId, "assignment.update")`**.
   There is no authenticated staff upload path today, and the nearest thing,
   `vehiclePhotoUploadAction`, trusts a `projectId` posted in the form with no
   check at all. Do not copy it.

**Records**
6. Driver → control: store `photoPath` plus the real `capturedAt`, `latitude`,
   `longitude`, `accuracy` in `driver_issue_reports.metadata`.
7. Control → driver: same fields in `driver_notifications.metadata`; give
   `sendDriverNotificationAction` an optional photo and let the push body say a
   photo is attached.

**Read paths — one is a trap**
8. `lib/data/driver-operations.ts` — `getDriverIssueMessagesByAssignmentId`
   selects an explicit column list, `id, message, created_at, issue_type,
   severity`, with **no `metadata`**. Add it, and add the photo to
   `DriverIssueMessage`. Miss this and photos save correctly and never appear.
9. `lib/data/driver-comms.ts::mapInbound` — already reads metadata; add the photo
   field. Notifications are read with `select("*")`, so nothing to change there
   beyond `mapNotification`.
10. Signed URLs both sides: the bucket is private. Follow
    `lib/data/vehicle-evidence.ts` — `createSignedUrls(paths, 3600)`.

**UI**
11. `driver-chat-thread.tsx` — camera button, local preview, photo bubbles, and
    the outbound photos from the control room in the same thread.
12. `comms-console.tsx` on `/mission-control` — attach a photo when sending, and
    show inbound photo thumbnails opening full size.
13. Tell the driver, before the shutter, that the photo carries time and place.

## Traps

- **The offline outbox is JSON only.** `enqueueDriverOutbox(token, { kind,
  payload })` cannot hold a `File`. Upload the photo first and queue only the
  path; if the upload fails because the driver is offline, say so plainly rather
  than showing a sent message with no photo.
- **The drawn stamp is not the evidence.** Pixels can be cropped, so the real
  values go in the row. If there is no fix, write "ไม่มีพิกัด" and store
  `latitude: null` — never a stale position. Same rule the heartbeat learned in
  `976`.
- **`sendDriverNotificationAction` has no permission check today** while every
  sibling action calls `requirePermission`. Fix it while you are in there.

## Native impact — needs a build only if something fails

The WebView already has what it needs: `NSCameraUsageDescription` and the Android
`CAMERA` permission are declared, and check-in already takes photos through the
same WebView. **Verify on one real device of each platform** that
`<input type="file" accept="image/*" capture="environment">` opens the camera
inside the app. If Android refuses the file chooser, that is a `react-native-webview`
setting and the only part of this feature that needs a new build.

---

# 4. Mobile UI/UX does not sit right on either platform

**Asked for:** the app's layout is uneven; make it look settled and native on
both iOS and Android.

Treat this as one pass over `apps/mobile-driver/App.tsx` and `src/theme.ts`, not
scattered tweaks:

- **Safe areas.** iPhone notch and home indicator, Android gesture bar. The
  bottom tab row is the usual casualty.
- **Touch targets** at least 44pt; a driver taps this with the phone in a cradle.
- **One type scale and one spacing scale** in `theme.ts`, used everywhere.
- **Platform texture where it is expected** — back affordance, sheet behaviour,
  haptics — without forking the whole layout.
- **Thai line height.** Noto Sans Thai clips tone marks at tight line heights;
  check the tab labels and the status strip.
- Compare against a real iPhone *and* a real Android. `mobile-shell-sim.png` and
  `scripts/simulate-mobile-shell.mjs` are only a sketch.

Any change here needs a build to reach anyone, so batch it with whatever else is
pending and ship one build.

---

# 5. Still open from before

- **The unexplained background freeze** (`976` §7). Every phone in the field test
  was on a build with no diagnostics, so nothing has been learned yet. First
  check `appBuild` on the pings: `0.2.0+3` is the build that can explain itself,
  `pre-0.2.0+3` cannot.
- **Bilingual rollout** (`976` §9) — 1,168 Thai literals, `/fleet` is the worked
  example.
- **FCM key rotation** and **revoking the old Expo token** starting `MUi7Y`.
- **DSA trader verification**, Apple case 102959627884 — upload a document whose
  name and address match App Store Connect, then reply to that case.

---

# 6. A one-day project counts as zero

**Reported:** a project starting Monday the 1st and ending Monday the 1st is
counted as 0 days.

`describeDuration` (`apps/web/components/ui/datetime-field.tsx:56`) measures
elapsed time, not operating days:

```ts
const minutes = Math.round((to.getTime() - from.getTime()) / 60000);
if (minutes <= 0) return "";
const days = Math.floor(minutes / (60 * 24));
```

Same day in, same day out is zero minutes, so it returns early and the summary
chip never appears at all — the field falls back to "เลือกครบทั้งสองช่องเพื่อดู
จำนวนวัน". A 1–3 September project reads "2 วัน" where the operation runs for
three days and is staffed for three days.

Elapsed time is the right answer for a time range and the wrong one for a date
range, and the function cannot tell which it was given. `DateRangeFields` knows
— it already takes `withTime` and `timeOnly` — but does not pass it down.

**Fix:** give `describeDuration` the mode.
- Date-only: count calendar days inclusive of both ends, never below 1.
  1 Sep → 1 Sep is `1 วัน`; 1 Sep → 3 Sep is `3 วัน`.
- With time: leave it exactly as it is.

Callers to check after the change: `create-project-form.tsx` and
`project-details-form.tsx` (date-only), `unit-setup-form.tsx` (date-only,
"ช่วงวันปฏิบัติการ"), `create-assignment-form.tsx` (`timeOnly` — must not move).

**Do the arithmetic on the `yyyy-mm-dd` parts, not on timestamps.** An ISO date
parsed as UTC and read back in Asia/Bangkok lands on the previous day, which is
the usual way an off-by-one fix turns into a different off-by-one.

**Nothing downstream is short a day.** `project_days` rows are inserted one at a
time by `app/actions/missions.ts`, not generated from the project range, so this
is a display defect only. Nobody is missing an operating day in the data.

**Guard:** unit tests over `describeDuration` — same day is 1 วัน, three-day
range is 3 วัน, a backwards range still reports backwards, and a `timeOnly`
range is unchanged.

---

# 7. Later

Left deliberately empty. The owner is adding to this list.
