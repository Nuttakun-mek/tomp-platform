# 982 — Everything still outstanding, after the data wipe

**Date:** 2026-09-17
**Updated:** 2026-09-22 after the enterprise web/mobile flow audit.
**Supersedes the open half of:** `977`, `980`, `981`
**Status:** the list of record. Close items here, not in the older documents.

## Closed 2026-09-25 (before the 1.0.0 iOS build)

- **Migrations 0043–0047** are on production (checked against the live schema);
  production records up to `0049`.
- **Supabase Auth**: Site URL and redirect allow-list are the production domain,
  public sign-up is off.
- **Contract oddities (§5)**: `shell_ready` removed; `canBackgroundLocation` is
  required, no longer guessed (see `978`).
- **Wave 2 (§3)**: amber at 80% of the planned window (30 minutes when the start
  is unknown); red past the end; "ยังไม่บันทึกเวลาออก" when done but not clocked out.
- **Wave 3 (§3)**: centre → driver photos already worked both ways; the fleet
  card no longer hides unacknowledged messages behind `slice(-4)` and can show
  the full history.
- **Wave 4 (§3)**: add driver + vehicle as a pair, Call Sign issued with it.
- **Wave 5 (§3)**: symbols on the map (both data paths) and the first vehicle
  edit path (`updateVehicleAction`); the add-pair action no longer saves VIP /
  luggage / shuttle / airport as "van".
- **986 follow-ups**: members can be removed (helper links revoked with them);
  the delete dialog names the Airport Transfer passenger data; Airport
  Transfer RLS reads `project_members` per project (`0050` — **written and
  CI-verified, NOT yet applied to production**); the `.ilike` email lookups
  are escaped.

Still open: apply `0050`; the helper-QR `project_manager` decision (owner);
the background freeze (needs field data from 1.0.0); running
`smoke:driver-flow` / `monitor:driver-ops` / `e2e:visual` against production;
device testing (§6); bilingual rollout (parked).

Read next with:

- `978-web-mobile-contract-boundary.md` for API/bridge ownership.
- `981-enterprise-web-mobile-flow-audit.md` for the current enterprise flow
  audit and release guidance.

---

# 0. The database was wiped today. Read this before submitting any build.

Every operational row is gone: 9 projects, 12 missions, 13 assignments, 13 call
signs, 28 drivers, 25 vehicles, 22 driver tokens, 20 observer tokens, 773 GPS
pings, 203 timeline events, 146 mobile sessions, and all 24 files in the
`driver-evidence` bucket. Done with `delete_project()` per project, which is the
only path that gets past the `timeline_events` immutability trigger, then the
central library rows separately.

**The files needed a second, different route.** `delete from storage.objects` is
refused outright by Postgres — *"Direct deletion from storage tables is not
allowed. Use the Storage API instead."* Clearing a bucket means walking it with
`storage.from(bucket).list()` and calling `.remove()` with the service-role key,
recursing because objects sit at `<projectId>/<assignmentId>/<file>` and `list()`
only reads one prefix at a time. Wiping the database alone leaves every photo
behind, keyed by project ids that no longer exist.

Kept deliberately: the owner profile `nuttakun.mek@gmail.com`, its `super_admin`
assignment (`project_id = null`, which is why deleting projects did not strip
it — that assignment cascades from `projects`, so a project-scoped admin row
would have been destroyed along with the projects), the single organization, and
all 11 roles / 29 permissions.

**Two consequences that will bite if forgotten.**

- **Apple's reviewer demo token is gone.** It lived on `PILOT-202609120349`,
  expiring 2026-09-28, and that project was tagged `smokeTest = true`. Before
  build 4 or 5 goes to Beta App Review, someone must create a fresh demo project
  with a crewed unit, issue a driver QR, and send Apple the new link and PIN on
  the existing case. Submitting without that is a guaranteed rejection: the
  reviewer opens the QR and finds nothing.
- **The three external testers hold dead QR codes.** TestFlight build 3 is
  approved and its public link still installs, so they can open the app, but
  there is no job behind their tokens. They need new QRs from whatever project
  replaces the old ones.

Verified TestFlight state as of today, from `scripts/check-testflight.mjs`:
build 3 **approved**, public link live, 3 external testers; builds 4 and 5 both
VALID but **not submitted** for external review. An earlier note claiming build 4
was already waiting in the group was wrong.

---

# 1. Shipped today — do not redo these

| | where | evidence |
|---|---|---|
| Passenger/observer QR could never be reissued | migration `0039` | expired-but-`active` tokens went 15 → 0; the duplicate project links 8 → 1; both partial unique indexes rebuilt with correct predicates |
| Both QR codes from one press | `call-sign-access-panel.tsx` | one button calls both actions and merges one sheet; a refused driver reissue no longer costs the passenger half |
| Fleet-link card reshaped, and foldable | same file | settings → scope → action → result, and it opens itself only when no link exists |
| Overview rebuilt | `project/page.tsx` | four real figures; publish moved to ตั้งค่า; the jobs÷missions "readiness %" deleted |
| Driver cards shortened, vehicle panel removed | `fleet-board.tsx`, `mission-control/page.tsx` | also deletes a heavy per-load fan-out that ran while the section was closed |
| Photo time/location stamp, both halves | `location.ts`, `App.tsx`, `driver-chat-thread.tsx` | **web half deployed, native half not on any phone — see §2** |

Deployed: health stamp `2026.09.17.1147`.

---

# 2. Waiting only on a mobile build

These are committed and green but cannot reach a driver until an EAS build runs.
The owner has asked for no builds for now, so this is a queue, not a task list.

- **`geolocationEnabled` on the WebView.** Android ships Geolocation off, so
  `navigator.geolocation` is dead inside the shell. Without it every photo waits
  out an 8-second timeout and prints "GPS ไม่มีพิกัด".
- **The GPS status posted twice after a page load.** The job tab only listens and
  never asks, so an answer that beats its listener is lost and its dot stays dark
  through a live session.
- **`getLastSharedLocation()` attached to `gps_sharing`.** This is the half that
  makes the photo stamp work. The web half is already live and reads
  `payload.detail`; the installed build posts no location, so the snapshot
  resolves null on a phone today. **The feature does not work until this ships.**

---

# 3. Designed, not built — waves from `981`

Full detail lives in `981`; this is the index.

- **Wave 2 — เวลาและค่าใช้จ่าย.** Daily clock-in/out against a multi-day
  mission, accumulated hours, a cost rate per driver and per vehicle, and
  warnings when the planned window or the budget is exceeded. Colour is amber at
  80% of the window and red past it, and **amber is the state that carries the
  work** — it exists so the control room can call the driver before the window
  closes. Warn only: never strip the job from the driver or the vehicle.
  Foundations that exist: `project_days`, and `driver_location_sessions` (GPS
  sharing, which is not duty time). A new table is needed. The driver page is web
  inside the WebView, so a clock button there ships by deploy with no rebuild.
- **Wave 3 — ศูนย์ควบคุม: ข้อความ.** Bubbles that size to their content, inbound
  left and outbound right; scrollback past the hard `slice(-4)` in the driver
  card; and centre-to-driver photos, which the outbound message type has no field
  for while inbound already carries attachments.
- **Wave 4 — ทรัพยากร.** Create a person and a vehicle together, with the Call
  Sign and QR issued afterwards on the dispatch page. Same as `977` §2.
- **Wave 5 — สัญลักษณ์รถ.** Selectable vehicle silhouettes instead of one 9px
  dot. Store in `vehicles.metadata.icon` (jsonb, no migration); default from
  `capacity`, never from `vehicle_type` — that column was free text with `Van`
  and `van` as separate values. `lucide-react` already ships every icon needed.
  **This wave builds the first vehicle edit path in the product:** there is no
  `updateVehicleAction` and no edit form anywhere, so today a plate typed wrong
  stays wrong. Two traps: `locations.ts` enriches metadata twice (Supabase and a
  Postgres fallback) so the icon must be threaded through both or the fallback is
  silently iconless; and the map legend renders from the same
  `TRACKING_MARKER_COLORS` the marker does, so recolouring the marker alone makes
  the legend lie.

---

# 4. Still open from `977`

- **Photos in the central comms thread, both directions** (`977` §3). The driver
  → centre direction works and is live. Centre → driver does not exist; that is
  Wave 3 above.
- **The unexplained background freeze** (`976` §7). Nothing learned yet — every
  phone in the field test ran a build with no diagnostics. Check `appBuild` on
  the pings first: `0.2.0+3` can explain itself, `pre-0.2.0+3` cannot. Note the
  GPS history was just wiped, so this restarts from zero data.
- **Bilingual rollout** (`976` §9) — 1,168 Thai literals, `/fleet` is the worked
  example.
- **FCM key rotation**, and **revoking the old Expo token** starting `MUi7Y`.
- **DSA trader verification**, Apple case 102959627884 — upload a document whose
  name and address match App Store Connect, then reply on that case.

Closed since `977` was written: §1 (project QR expiry), §4 (the mobile UI pass,
documented in `980`), §6 (a one-day project counted as zero — `describeDuration`
now takes `{ dateOnly }` and counts calendar days inclusive, with tests).

---

# 5. Still open from `980`

2026-09-22 update: the web GPS card now asks the shell for status on mount,
driver messages/issues now carry `metadata.clientEventId`, and the web send path
keeps optimistic pending messages until the retry/send is reconciled. Treat the
old "two web-owned message bugs" bullet below as closed. The remaining work is
GPS status UX consistency, real-device validation, and production observability.

2026-09-22 later update: the QR -> PIN/session -> readiness -> GPS share ->
complete job -> next job -> accept continuation smoke path now exists as
`npm run smoke:driver-flow`; the read-only operational monitor now exists as
`npm run monitor:driver-ops`; and the opt-in visual screenshot suite now exists
as `npm run e2e:visual` with `E2E_VISUAL=1`. They still need to be run against a
stable staging/production target before the next release sign-off.

New open items from the 2026-09-22 audit:

- **Two GPS indicators, one truth.** Decision made 2026-09-22: the server/control
  center GPS row is the confirmed truth. The native shell can show only local
  transmitter state, while the web GPS card confirms when the control room
  received a location. Still needs real-device validation.
- **One-tap call to the control room** from the driver page — decision made
  2026-09-22: keep it in the message/communication screen, not as a persistent
  action on every tab. Still needs Android/iOS dialer validation.
- **"Last received by the control room at HH:MM"** on the driver page. The most
  reassuring thing an operator can show a driver, and it makes a silent link
  visible without the driver guessing. The GPS card now shows this copy; keep
  this open only for real-device validation.
- **Contract oddities.** `NativeStatus` declares `shell_ready` and the app has
  never sent it. `buildNativeStatusMessage` hard-codes
  `canBackgroundLocation: status !== "session_missing"`, which claims background
  capability for every status but one — the same class of untruth as the two
  already fixed. Fixing it threads the real value through both tracks.
- **Two web-owned message bugs.** A message that fails to send stays on screen
  forever, because the optimistic bubble is never removed. And driver messages
  carry no idempotency key, so `flushDriverOutbox` re-sends on any non-success.
  `lib/driver/message-idempotency.ts` now exists; confirm it is wired into the
  send path before closing this.

---

# 6. Device testing, still owed

`979`'s device list stands. Three items get extra attention because they cover
what changed and cannot be proven by a test: the **Android gesture bar** and the
**iPhone notch** on a real device of each, **`ออกจากงานนี้` / sign-out** (the
`_v2` key migration), and the **offline flush without duplicate rows**.

One question from the owner is still unanswered and blocks a diagnosis: when the
photo button is pressed in the app, **does the camera or gallery open at all**,
and **what does the red error strip say**? The code sets `photoError`; that text
names the failure.

---

# 7. Boundary

Every file touched today under `apps/web/**` belongs to the web agent by the
split recorded in `978`. The owner directed this work to the mobile track
explicitly. `978` should be updated to say so, or the split should be retired —
it no longer describes how the work is actually being done.

2026-09-22 update: keep the split, but read it as a code-ownership boundary, not
as a product-design boundary. Web/server owns operational truth and driver
WebView screens; native mobile owns device capabilities and shell behavior. If a
change crosses API shape, bridge shape, route path, session storage, or GPS
payload semantics, update `978` before implementation.
