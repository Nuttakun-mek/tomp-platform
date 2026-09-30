# 990 — Ground Transfer + Airport Transfer upgrade plan (no app build)

Date: 2026-09-28. Status: **plan, awaiting owner go-ahead and the decisions in §5.**
Owner's constraint: nothing may need a new iOS/Android build; mobile changes
only if they can ship over the air (OTA). Everything below is web-side.

## 0. Boundary

Same as `989` §0 — untouched: `app/ground-transfer/driver/**`,
`components/driver/**`, `app/api/driver/**`, `lib/api/driver-token.ts`,
`lib/driver-access/**`, `packages/driver-core/**`. Also untouched: the server
actions the driver page calls (`assignmentStatusUpdateAction`,
`driverIssueReportAction`) — where this plan must react to a driver's status,
it does so with a database trigger, not by editing the driver's code path.

Result: **no build, no OTA** for any item. A handed-off Airport Transfer job
reaches the driver as an ordinary Ground Transfer job, which the app already runs.

Checked facts this plan rests on:
- `airport_transfer_cases.driver_id` / `vehicle_id` reference the same
  `drivers` / `vehicles` Ground Transfer uses (0040) — a case can map to a
  Call Sign without new link tables.
- `airport_transfer_import_batches` / `_import_rows` exist (0040); the
  imports page is a placeholder ("เลือกไฟล์ .xlsx — ยังไม่เปิดใช้งาน").
- Flight lookup is AirLabs (`lib/airport-transfer/flight-provider.ts`); the
  only cron (`vercel.json`) runs once a day at 00:00 UTC.
- Push already sends `sound: "default"` on channel `driver-alerts`, and the
  app's handler sets `shouldPlaySound: true`. The missing-sound report is not
  explained by code; it waits on the owner's device answers (open vs
  background, silent/Focus mode).
- No Excel or Playwright library is installed in `apps/web`.
- Production has 0 Airport Transfer cases (wiped 2026-09-17).

## 1. Airport Transfer

### AT-1 Excel import — a template to send customers, then staging, check, confirm
Owner's request (2026-09-28): a form the customer fills in, which we upload
and check with what the system already has.

- **Template download** — "ดาวน์โหลดแบบฟอร์ม" on the imports page returns
  `TOMP-airport-transfer-<projectCode>.xlsx`, generated on the server so it
  always matches the importer:
  - sheet "กรอกข้อมูล": one row per passenger trip, fixed columns in Thai with
    English underneath — ขาเดินทาง (arrival/departure), วันเดินทาง,
    เที่ยวบิน, ชื่อ, นามสกุล, คำนำหน้า, มือถือ, อีเมล, จำนวนผู้โดยสาร,
    กระเป๋า, จุดรับ/ส่ง (โรงแรมหรือที่อยู่), ลิงก์แผนที่, Fast Track, หมายเหตุ;
  - dropdowns (data validation) for ขาเดินทาง, คำนำหน้า, Fast Track; date
    cells formatted as dates; required columns highlighted;
  - one example row in grey, which the importer ignores;
  - sheet "วิธีกรอก": short rules and the example explained;
  - hidden cell with a template version so the importer can tell an old form.
- Parse `.xlsx` on the server with `exceljs` (new dependency, web only). A file
  made from the template maps itself; any other file goes through the column
  mapping step below.
- Upload → `import_batches` row → one `import_rows` row per line with the
  raw values.
- Column mapping screen: guess from headers (Thai/English synonyms), editable,
  remembered per project in `import_batches.metadata`.
- Checks per row, shown before anything enters `airport_transfer_cases`:
  required fields, date/time/flight number normalised, AirLabs lookup
  (throttled, reusing `verifyFlightByNumberAndDate`), duplicates against
  existing cases (same passenger + flight + date).
- "ยืนยันนำเข้า" commits only rows that pass; the rest stay in the batch to fix.
- Files: `app/(app)/projects/[projectCode]/airport-transfer/imports/**`,
  `lib/airport-transfer/import/{parse,map,validate,commit}.ts` + tests.
- Size: medium-large. Migration: none expected (tables exist).

### AT-2 Hand a case to Ground Transfer (985 Part B)
- Button on the case page, visible when the case has a driver and vehicle and
  the project has Ground Transfer on: "ส่งงานต่อให้ Ground Transfer".
- Finds the project's Call Sign for that driver + vehicle (or asks the user to
  pick one), and a main job: an "Airport Transfer" mission covering the
  project's days, created once per project if missing.
- Creates the sub-job with the existing rules (`checkSubJob`: inside the main
  job and project, no overlap) — pickup/dropoff/times from the case.
- Migration `0051`: `airport_transfer_cases.ground_transfer_assignment_id`,
  `'handed_off'` added to the `operational_status` check, and a trigger on
  `assignment_status_updates` that writes arrived/onboard/completed into
  `airport_transfer_status_events` and moves the case's status — the status
  bridge, without touching the driver's code path.
- The case page then links to the unit's passenger tracking link (the
  observer link already has the real trail).
- Undo: allowed until the driver acknowledges; cancels the sub-job, clears
  the link, case back to `assigned`.
- Size: medium. Needs the owner to run `0051` (see §4).

### AT-3 "ต้องทำถัดไป" queue by flight
- AT home becomes a queue sorted by `next_action_at` / pickup time, grouped
  today / tomorrow, with flight status chips; case cards stay on the list page.
- Flight re-check: the daily cron cannot do "every 30 minutes". Instead,
  opening the queue re-checks cases whose pickup is within 24 h and whose last
  check is older than 30 min (throttled server action), and a delay moves
  `recommended_pickup_at` with a visible "เที่ยวบินล่าช้า — เวลารับเลื่อน" note.
  (A true schedule needs Vercel Pro crons or an external pinger — §5.)
- Size: medium.

### AT-4 Passenger link out
- After handoff, "ส่งลิงก์ติดตามให้ผู้โดยสาร": copy text / `mailto:` / LINE
  share URL with the observer link. No SMS provider in this plan.
- Size: small.

## 2. Ground Transfer

### GT-1 Day close and export
- New "สรุปปิดวัน" view per project and date: one row per unit — jobs done,
  clock-in/out, counted hours, OT hours, base + OT amount
  (`estimateVehicleUsageCost` as the fleet card uses it), open issues.
- Export: CSV with UTF-8 BOM (opens in Excel with Thai intact, no new
  dependency) — or `.xlsx` via `exceljs` if AT-1 has added it (§5).
- Size: medium.

### GT-2 Proactive alerts in the control room
- Computed from data the fleet board already has, per job, fired once each:
  - start in ≤ N min and no acknowledged/ready/on-the-way status,
  - active job and GPS stale > M min,
  - OT starts in ≤ 15 min, or OT has started.
- Delivery: a toast stack + optional sound on the page, and browser
  `Notification` when the tab is in the background (asks permission once).
- Settings per browser (thresholds, sound on/off) in localStorage.
- Size: medium.

### GT-3 Copy a day
- On a unit's day row: "คัดลอกวันนี้ไป…" → pick target day(s) inside the main
  job; each job copied through `checkSubJob`; conflicts skipped and listed.
- Size: small-medium.

### GT-4 Import sub-jobs from Excel
- Same parser as AT-1; columns Call Sign, date, start, end, pickup, dropoff,
  note; each row through `checkSubJob`. Build after AT-1.
- Size: small once AT-1 exists.

### GT-5 Browser tests (Playwright)
- Dev dependency only. Flows: create main job → sub-job (overlap refused) →
  issue QR → driver page opens with PIN → GPS ping → fleet card live.
- Runs against a local stack (docker Postgres + `next start` with a
  credential-free `.env`), never production credentials; CI job optional.
- Size: medium; needs §5 decision on where it runs.

## 3. Order

| Step | Items | Why this order |
|---|---|---|
| 1 | AT-1 (template + import) | Asked for by the owner; AT has no way in for data today |
| 2 | GT-1, GT-2 | Daily value, no migration; GT-1 can export `.xlsx` with the same library |
| 3 | AT-2 (+ `0051`) | Makes AT cases real jobs with QR/GPS/chat |
| 3b | GT-4 | Reuses the AT-1 parser |
| 4 | AT-3, AT-4, GT-3 | Build on 2 and 3 |
| 5 | GT-5 | Locks the flows above in |

Each item: own commit, tests, deploy, the §0 check (`git diff --stat` shows no
driver paths).

## 4. What the owner has to do

- Run migration `0051` in the VS Code terminal when AT-2 is ready (the harness
  blocks production writes from here): `node scripts/apply-migrations.mjs`.
- Decisions in §5.

## 5. Decisions

1. **Export format** — CSV now (recommended), or `.xlsx`?
2. **Alert thresholds** — defaults proposed: not moving 15 min before start,
   GPS stale 5 min, OT warning 15 min before.
3. **Handoff mapping** — use the Call Sign that has the case's driver + vehicle
   (recommended), or always let the user pick?
4. **Flight re-check** — on-open re-check (no cost), or pay for Vercel Pro /
   an external pinger for a real 30-minute schedule?
5. **Playwright** — local only, or also a CI job?

## 6. Shipped 2026-09-28 — steps 1 and 2

Owner: "ทำ 1-2 ก่อน ให้ละเอียด". Defaults taken for §5: `.xlsx` export, alert
thresholds as proposed.

**AT-1 Excel import** (`lib/airport-transfer/import/**`, imports pages)
- `columns.ts` is the single definition; `workbook.ts` builds the form from it
  and reads files back (template detected by a very-hidden `_tomp` sheet).
- `normalize.ts`: dates (ISO, d/m/y, Buddhist year, Excel serial, date cells),
  direction in Thai/English, header synonyms for customers' own files.
- `flight-match.ts`: picks the leg that lands in (arrival) or leaves (departure)
  a Thai airport; codeshare duplicates count once.
- `batch.ts`: upload → rows → check (flights looked up once per flight + date,
  4 at a time, 120 per pass, reused for 30 min; duplicates against the file and
  the project's cases) → "ยืนยันนำเข้า" (valid rows, and warnings if ticked).
- Arrival rows become pickup = the flight's airport, dropoff = the hotel;
  departure the other way round. Pickup time = landing + 45 min / take-off − 3 h.
- `case-insert.ts` now holds the case write shared with the case form.
- New dependency: `exceljs@4.4.0` (web only). It brings a moderate `uuid`
  advisory for v3/v5/v6 with a buffer, a path exceljs does not use.

**GT-1 Day close** (`/ground-transfer/day-close`, tab "สรุปปิดวัน")
- `lib/domain/day-close.ts`: one row per unit per Bangkok day, priced once
  from first planned start to last planned end against the real clock-in/out
  (a clock-out after midnight belongs to the day it started); notes say what
  is missing instead of guessing. Today counts a running shift to now.
- Export: `day-close/export?date=` → `.xlsx` with a totals row.

**GT-2 Alerts** (`components/mission-control/control-alerts.tsx`)
- `lib/domain/control-alerts.ts`: not moving 15 min before start (danger once
  late, for an hour), GPS offline by the app's own freshness rule and silent
  ≥ 5 min on a running job, OT 15 min before the end and priced once running.
- Sticky bar on the control room; each alert announced once per browser for
  12 h: a tone (sound is opt-in, browsers need a click first) and a desktop
  notification when the tab is hidden. Clicking an alert opens that chat.

§0 held — no driver paths touched.

### AT-1 follow-up (2026-09-30)
- Template in Thai (`?lang=en` for English); every value that can be a choice
  is a dropdown with a stop-error — flight date lists the project's days plus
  one either side, passengers 1–30, bags 0–30 — held on a very-hidden `_lists`
  sheet. Dates read as "2026-10-02 พฤ."; the importer takes the ISO prefix.
- Import page is one flow: a step strip (form → upload → check/fix → confirm →
  assign vehicles in "ข้อมูลการเดินทาง"), a slim form row, then upload with the
  files right under it. A row that failed a check is fixed on its check page
  (`fixAirportTransferImportRow`) instead of editing the file and re-uploading.
