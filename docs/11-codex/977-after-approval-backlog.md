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

# 2. One concern per page: resources form units, dispatch gives them work

**Decided with the owner 2026-09-16.** Today one form on the dispatch page does
four things in a single submit — `createMissionAction`, `createCallSignAction`,
`createDriverAccessTokenAction`, `createObserverAccessTokenAction`
(`components/assignments/unit-setup-form.tsx:99,154,173`). Four different layers
in one button is why the flow reads as confusing. Split it so each page finishes
its own job.

**The three pages, and what each one owns**

| page | owns |
|---|---|
| `/resources` (no `projectId`) | the central library: people and vehicles that outlive any one project |
| `/resources?projectId=…` | **this project's resources, and the units formed from them** — already a project workspace tab |
| `/projects/[id]/assignments` | **work only**: missions and assignments for units that already exist |

**On the project resources tab**
- "เพิ่มหน่วย" creates the driver and the vehicle **together** and forms the call
  sign in the same save — `createDriverAction` + `createVehicleAction` +
  `createCallSignAction`, which already takes `driverId` and `vehicleId`.
- Importing from the library ends the same way: pick a person and a vehicle,
  import both copies, pair them into a unit **before leaving this page**. Never
  hand a half-formed unit to dispatch.
- Issue the QR here, when the unit is formed. Nothing blocks it:
  `createDriverAccessTokenAction` needs only `projectId` + `callSignId` — no
  assignment — and `/driver` already has a waiting view for a driver who scans a
  valid QR before any work exists.
- Swapping later stays where it is: `updateCallSignCrewAction` changes the driver
  or the vehicle and keeps the same call sign. Put it on the unit card here, and
  have it write a timeline event so the control room sees the unit changed hands.

**On the dispatch page**
- Stop creating units, and stop minting tokens. The unit picker lists what the
  resources tab already formed. If nothing is there, send the operator to the
  resources tab rather than growing a second creation path.

**Constraints this design respects, so do not fight them**
- `call_signs.project_id` is **required**: a unit cannot exist in the central
  library. Pairing belongs at import, not in the library. (If pairs turn out to
  repeat across projects, add a template later — it layers on top without
  reworking this.)
- Library rows are **copied** into a project (`source_driver_id` /
  `source_vehicle_id`, status reset to available), and the partial unique index
  from migration `0035` refuses a second copy of the same source.

**No schema change, and existing units are untouched.** This is a move of where
things happen, not a change to what is stored.

**Guard:** a test that the dispatch page no longer calls `createCallSignAction`
or either token action — the same shape as the no-Thai-literal guard in
`lib/fleet-access/no-actions.test.ts`, which exists because a split like this
quietly grows back.

---

# 3. Photo messages from the driver, stamped with time and place

**Asked for:** the driver can send a photo in the chat with the control room, and
the system stamps the capture time and coordinates onto it as proof.

**Where it goes today.** Driver messages are `driver_issue_reports` rows
(`apps/web/app/actions/driver.ts`, `driverIssueReportSchema` in
`packages/types/schemas.ts:133`): `issueType`, `severity`, `message`, `metadata`.
No attachment anywhere, and `components/driver/driver-chat-thread.tsx` has no
file input.

**Reuse, do not invent.** The check-in flow already uploads photos:
`lib/storage/checkin-photos.ts` → `uploadDriverEvidencePhoto` into the private
`driver-evidence` bucket, with type and 10 MB validation, and
`components/driver/driver-photo-check.tsx` already resizes client-side.

**Build**
1. Capture with `capture="environment"`, read the position at capture time, and
   burn `เวลา · พิกัด` into the image on a canvas before upload — that is what
   makes the photo readable as evidence when it is forwarded out of the system.
2. **Also store the real values** — `recordedAt`, `latitude`, `longitude`,
   `accuracy` — in the row's metadata beside the storage path. Pixels can be
   cropped; the row is what an audit trusts. Never let the drawn text be the only
   copy.
3. Show the thumbnail in the control room thread and in the driver's own thread.
4. Say plainly in the UI that the photo carries time and location, before it is
   taken. This is a passenger-carrying operation; drivers should know.

**Watch out:** a photo with no fix. Do not block the send — mark it
"ไม่มีพิกัด" and store `latitude: null` rather than stamping a stale position,
the same rule the heartbeat learned the hard way in `976`.

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
