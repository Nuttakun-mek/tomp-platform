# Phases M / N / O / P — cleanup, hardening, CI (roadmap `945`)

Executed together after Phase L on the "ดำเนินการแก้ไขทั้งหมด" instruction.

## Phase M — cleanup + hardening

### Dead code
Deleted ~48 unused component files left by phases D / H / K / L:
- Old `<DriverCard>` cluster (9): driver-card, driver-card-summary,
  driver-assignment-acknowledgement, driver-emergency-actions,
  driver-notification-panel, driver-readiness-card, driver-route-card,
  driver-route-change-alert, driver-activation-checklist,
  driver-access-qr-placeholder, driver-contact-strip, driver-task-hero,
  driver-quick-actions, driver-next-action.
- MC panels dropped in H/K (8): driver-operations-panel, assignment-monitor,
  driver-signal-panel, decision-panel, realtime-status-panel,
  driver-notification-console, route-change-console, project-switcher,
  exception-list, location-health-panel, map-placeholder, readiness-board,
  realtime-status, timeline-feed.
- `dashboard/*` (5 — `/` is a redirect now), `readiness/*`, `publish/*`,
  project-summary-card / project-list / project-progress-rail /
  project-workspace-header / project-operation-days, ~12 unused `ui/*`
  primitives (breadcrumb, contact-strip, data-table, loading-state,
  notification-card, page-section, stat-card, …), placeholders.
- `CreateMissionForm` was among the "dead" set but is real functionality —
  **re-added to the project overview** (it was only on the retired
  `/projects/[projectId]` page).

### Comms resolve flow
`resolveDriverMessageAction({ id, projectId })` sets `driver_issue_reports.status
= 'closed'`. `<FleetBoard>` badge now counts **open** inbound (`status != closed`)
instead of the client-only `seenAt` heuristic, with a "รับทราบ" button per message
in the expanded card.

### Misc
- `/superadmin/organizations` → `redirect('/superadmin')` (single-org).

## Phase N — mobile

- `<DriverTaskView>` header: `truncate` / `min-w-0` / `shrink-0` so long project
  or call-sign names don't overflow at 320 px.
- (Phase K already did the layout: `100svh`, `env(safe-area-inset-*)`,
  `max-w-[520px]` single column.)
- **Still needs the user**: `eas build` of `apps/mobile-driver` (Expo account) for
  real background GPS. The driver web screens are the webview basis and are
  responsive from ~320 px.

## Phase O — ops depth (partial)

- `<UndoToast>`-style undo: after archiving a project, an 8 s
  "เก็บถาวรแล้ว · เลิกทำ" restores it.
- Deferred: `<ReadinessGate>` hard-gate, `<ChangeRequestButton>` wiring,
  role-matrix editor, command palette — these are larger and lower urgency.

## Phase P — CI

- `.github/workflows/ci.yml` — typecheck + lint + test + build + `security:env`
  on push / PR to `main` (Ubuntu, Node 20). Offloads the ~6 min local Windows
  build and protects `main`.
- Deferred (needs secrets / a test Supabase project): Playwright E2E for
  login→project, dispatch→QR→PIN, driver preflight→GPS→status→centre.

## Still open (needs the user, from `945`)
- Supabase dashboard: disable open signups · Site URL / redirect URLs ·
  rotate the access token.
- Vercel env: confirm `TOMP_SCOPED_READS`, `DRIVER_ACCESS_TOKEN_SECRET`,
  `TOMP_ENABLE_POSTGRES_FALLBACK`.
- Migrate the legacy `vercel.json` `builds`+`routes` (needs the dashboard
  Root Directory set to `apps/web`).
- RLS **write** policies — low ROI while every write goes through the
  service-role client; revisit if that changes.
