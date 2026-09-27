# 989 — Web UX upgrade plan (web only, mobile untouched)

Date: 2026-09-27. Status: **proposal, awaiting owner decisions** (§6).
Builds on `981` (screen cleanup, wave 1). Evidence below comes from reading the
pages and a scan of every `.tsx` for Thai UI strings of 60+ characters.

## 0. Hard boundary — what must not change

The TOMP Driver app is a WebView over the web's driver pages. Nothing in this
plan touches:

- `app/ground-transfer/driver/**` (page, layout, `driver-dark.css`)
- `components/driver/**` (rendered inside the app)
- `app/api/driver/**`, `lib/api/driver-token.ts`, `lib/driver-access/**`
- `packages/driver-core/**` (the bridge contract)

Everything below lives under `app/(app)/**` and the components only those pages
render. Check before merging each wave: `git diff --stat` shows none of the paths
above, and `npx vitest run components/driver` still passes.

## 1. One unit, four screens — the main overlap

A Call Sign (one driver + one vehicle) is drawn four times, each with its own card:

| Screen | Component | What it shows |
|---|---|---|
| ทรัพยากรโครงการ | `ExistingResourcePairingPanel`, `ProjectResourceManager` | the pair, rates |
| ภารกิจและงาน (dispatch) | `CallSignAccessPanel` | details, photos, QR, plan by day (989 day view) |
| ศูนย์ควบคุม | `FleetBoard` | live status, GPS, cost |
| `/resources/vehicles` | `VehicleOperationsBoard` + its own `LiveLocationMap` | current/remaining/done jobs, GPS |

Proposal: one job per screen.
- **Resources = set up.** A compact table of units (Call Sign, driver, vehicle,
  rate). Adding a unit (from the central library or new) opens in a drawer
  instead of three stacked panels.
- **Dispatch = plan.** The unit card with its day-by-day plan stays the place to
  see and change work. Add "+ งาน" on a free day, pre-filled with that date, so
  step 2's separate form is only needed for bulk entry.
- **Control = live.** Fleet card only.
- **`/resources/vehicles` retires.** Its board and map repeat the control room;
  keep the vehicle profile page (`/resources/vehicles/[id]`) as the history view
  and link to it from each card.

## 2. Control room — four ways to say "needs attention"

`CommandCenterHeader` ("ต้องติดตาม N"), the fleet board's metric chips
("ต้องติดตาม", "ใกล้/เกินเวลาบริการ", …), `JobStatusBoard` ("สถานะงานทั้งหมด",
the same jobs listed by job) and `RiskAndExceptionPanel` ("งานที่ยังขาดข้อมูล")
all count overlapping sets.

Proposal:
- Fleet board chips become **filters** (click "ใกล้/เกินเวลา" → only those cards).
- `JobStatusBoard` becomes a **"ดูแบบรายการ" toggle** on the fleet board, not a
  second section.
- Missing-data items show as a badge on the affected card; the separate panel goes.
- The header keeps the project name only; its two counts repeat the chips.
- Unread badge on a fleet card opens the chat console filtered to that Call Sign.
- From `xl`, map and fleet board side by side; chat as a right drawer on tablet.

## 3. Dispatch — ordering is shown twice

`DriverJobOrderPanel` ("ลำดับงานต่อ Call Sign") lists the same jobs, in the same
running order, that the unit card now shows by day. Move its reorder buttons into
the day rows of `UnitSchedule` and delete the panel.

The overview page's `ProjectMissionBoard` repeats step 1's mission list; keep one
(proposed: dispatch) and link to it from the overview.

## 4. Admin — three entry points

`/superadmin`, `/permission/*` and `/ground-transfer/superadmin/dev-tools/*`
(9 pages) are separate menus. Proposal: one "ผู้ดูแลระบบ" with tabs ผู้ใช้ ·
สิทธิ์ · เครื่องมือ. The pilot-era tools (pilot-checklist, runbook, readiness,
smoke-test, live-test) fold under one "เครื่องมือทดสอบ" page; keep apple-review
and purge-test-data where they are reachable.

## 5. Text that costs space

Top files by long Thai strings (count, total characters):

| File | Long strings | Chars | Note |
|---|---|---|---|
| `components/assignments/call-sign-access-panel.tsx` | 12 | 996 | warnings and QR notices |
| `components/assignments/unit-credential-sheet.tsx` | 6 | 599 | "download now" notices |
| `components/resources/create-vehicle-form.tsx` | 5 | 550 | cost hint… |
| `components/resources/create-resource-pair-form.tsx` | 5 | 506 | …the same cost hint again |
| `components/resources/project-resource-manager.tsx` | 6 | 529 | empty states |
| `components/assignments/create-assignment-form.tsx` | 5 | 395 | disabled-state paragraph |
| `components/assignments/mission-assignment-step.tsx` | 5 | 376 | |
| `app/(app)/projects/[projectCode]/ground-transfer/resources/page.tsx` | 4 | 347 | page subtitle |
| `components/assignments/dispatch-workspace.tsx` | 3 | 325 | step descriptions |
| `components/mission-control/fleet-board.tsx` | 3 | 287 | board description |

(`components/driver/**` also appears in the scan — out of scope, see §0.
`app/privacy` is legal text and stays.)

Rules to apply everywhere under `app/(app)`:
1. Helper text is one line (≈60 characters). Anything longer goes behind a `?`
   `HelpTip` (the fleet board already has one).
2. A page subtitle that restates the title and tab goes.
3. A disabled button says why in its tooltip and one short line, not a paragraph.
4. One shared hint for vehicle cost (`ServiceTimeSummary` or a `CostHelp`), used
   by both vehicle forms.
5. One `StatusChip` for job status (tone and label from one map), replacing the
   per-component colour tables.

## 6. Waves and decisions

| Wave | Scope | Risk | Needs from owner |
|---|---|---|---|
| A | §5 text diet, `StatusChip`, `HelpTip` | low | nothing |
| B | §2 control room merge | medium | OK to drop `JobStatusBoard` / risk panel as sections |
| C | §3 dispatch: reorder in day rows, "+ งาน" on a day | medium | OK to delete `DriverJobOrderPanel` |
| D | §1 resources table + drawer, retire `/resources/vehicles` | medium | OK to retire the page |
| E | §4 admin consolidation | low | which dev tools to keep |

Each wave: its own commit, tests, deploy, and the §0 check.
