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

# 2. Create the crew and the vehicle in one step

**Asked for:** creating a unit should create the person and the vehicle
together, while still allowing a later swap — a different vehicle under the same
driver, or a different driver in the same vehicle — **keeping the same call
sign.**

**What already exists**
- `createCallSignAction` (`apps/web/app/actions/call-signs.ts:127`) takes
  `driverId` and `vehicleId` together, so a unit is already one record.
- `updateCallSignCrewAction` (same file, line 35) swaps driver and/or vehicle on
  an existing `callSignId` — the "same call sign, different crew" case is built.

**What is missing.** The *records* are made elsewhere:
`components/resources/create-driver-form.tsx` and `create-vehicle-form.tsx`, on
the resources page. `components/assignments/unit-setup-form.tsx` can only pick
from what already exists, so standing up a new unit means three screens.

**Fix:** inline "add new" inside the unit form for both fields — call
`createDriverAction` / `createVehicleAction`, then pass the new ids straight into
`createCallSignAction`. One screen, one save. Keep the existing swap UI reachable
from the unit afterwards, and make sure the swap writes a timeline event so the
control room can see the unit changed hands.

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

# 6. Later

Left deliberately empty. The owner is adding to this list.
