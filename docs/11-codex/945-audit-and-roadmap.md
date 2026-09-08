# Audit + roadmap (2026-09-08, after Phase K)

Full sweep of what still needs work, grouped and prioritised. Phases A–K are
deployed; this is what remains.

---

## 1. Architecture / IA — the "หน้าเว็บงง" problem

| # | Issue | Impact |
|---|---|---|
| 1 | **Not project-centric.** `/`, `/mission-control`, `/assignments`, `/resources` are global pages with a project switcher on top. User wants: login → project list → *enter* a project → that project's tools only. | high — the core UX complaint |
| 2 | **Duplicate project route.** `/project` (singular, reads `?projectId`, **no access guard**) is what production actually serves via the `vercel.json` rewrite; `/projects/[projectId]` (has the Phase F `<AccessDenied>` guard) is shadowed on prod. → the guard never runs in production. | high — latent security/UX bug |
| 3 | **Legacy `vercel.json` `builds`+`routes`.** Every nested dynamic route needs a hand-written rewrite (`/resources/vehicles/([^/]+)` broke because of this). Bypasses `next.config` redirects/headers. | med — fragile, recurring |
| 4 | `/` dashboard binds to `projects[0]` — meaningless with >1 project. | med |
| 5 | **No delete / archive project** action or UI. | med — explicitly requested |
| 6 | `/recovery` exists but is not in the nav; `/portal` only for `customer_viewer`. | low |
| 7 | `/superadmin/organizations` page still exists (unlinked after Phase K). | low |

## 2. Security / RLS

| # | Issue |
|---|---|
| 8 | **No RLS write policies.** All writes use the service-role client + app-level `requirePermission()`. A missed check = no DB backstop. (Plan `927` Phase 4b.) |
| 9 | Vercel env not confirmed: `TOMP_SCOPED_READS`, `DRIVER_ACCESS_TOKEN_SECRET` (falls back to a dev default → weaker token/PIN hashing), `TOMP_ENABLE_POSTGRES_FALLBACK`. |
| 10 | Supabase dashboard TODOs (`933`): disable open signups, set Site URL / redirect URLs, rotate the access token `sbp_fc93…`. |

## 3. Driver / mobile

| # | Issue |
|---|---|
| 11 | **`apps/mobile-driver` (Expo) never EAS-built.** Background GPS (screen off) only works there. Needs the user's Expo account. |
| 12 | Driver web components need a full responsive pass (layout is fixed now; some inner components still assume width). Screens are the mobile-app webview basis. |
| 13 | `components/driver/driver-quick-actions.tsx` + `driver-next-action.tsx` — dead (replaced by the chat thread / task view). |
| 14 | iOS HEIC: `createImageBitmap` may not decode → falls back to raw upload (bucket is 10 MB now, tolerable). |

## 4. Mission control / ops

| # | Issue |
|---|---|
| 15 | **Dead components** after the Phase H/K redesign: `DriverOperationsPanel`, `AssignmentMonitor`, `DriverSignalPanel`, `DecisionPanel`, `RealtimeStatusPanel`, `DriverNotificationConsole`, `RouteChangeConsole`, `command-center-header` (partial). Delete. |
| 16 | `<VehicleMessageForm>` still inside the collapsed `<VehicleMonitorPanel>` — redundant with `<CommsConsole>`. |
| 17 | Comms "resolve": the centre can't mark a driver message handled; the FleetBoard badge is client-only (`seenAt`). Needs a real `status` update on `driver_issue_reports`. |
| 18 | No realtime (10–15 s polling). Fine for now; Supabase channel is a later upgrade. |
| 19 | Verify driver trip-status → FleetBoard live with a fresh end-to-end test (data path is correct; earlier reports predate Phase G/H). |

## 5. Master-plan features not built (4b / 5b)

Role-matrix editor (`/superadmin/roles` is read-only) · `/coordinator` `/vendor`
`/changes` full pages · `<UndoToast>` + optimistic rollback · `<ReadinessGate>`
hard-gate + `<ChangeRequestButton>` wiring · command palette · `<ContactStrip>`
wired (needs a per-assignment contact model) · dispatcher saved views.

## 6. Testing / quality

| # | Issue |
|---|---|
| 20 | Only unit tests (`lib/**/*.test.ts`). No E2E for login→project, dispatch→QR, driver preflight→status→centre. |
| 21 | `scripts/ui-smoke.mjs` mobile UI harness — never built. |
| 22 | Build ~6 min on Windows; no CI. A GitHub Actions build/test/typecheck would offload it. |
| 23 | Leftover "ทดสอบ / ระยะถัดไป" copy in `operations-runbook-panel.tsx` and elsewhere. |

## 7. Data model (backlog, low urgency)

`organizations` table + `organization_id` FKs · `is_org_admin` / `current_org_id`
SQL fns · 5 dead `roles` rows — all dead weight for a single-org product. Drop in
a dedicated migration once nothing references them.

---

## Roadmap

### Phase L — project-centric IA  *(next, largest)*
- Login → `/projects` is home: cards of accessible projects + **สร้างโครงการ** +
  **ลบ/เก็บถาวรโครงการ** (owner / super_admin, with confirm → `status='archived'`).
- `/projects/[id]` = the workspace, tabbed: ภาพรวม · จัดงาน · ศูนย์ควบคุม ·
  ทรัพยากร · **ตั้งค่า** (project members + rename + archive). Everything scoped to
  that project; no cross-project data.
- Retire global `/mission-control` `/assignments` `/` → redirect to the picker or
  the project-scoped tab.
- Resolve the `/project` vs `/projects/[projectId]` duplication; make the guarded
  route canonical (fix the `vercel.json` rewrite or drop the singular page).
- `deleteProjectAction` (soft archive).
- Per-project member management in ตั้งค่า (assign role, remove) — this is where
  "ผู้ใช้และสิทธิ์" mostly lives; platform-wide user creation stays in ระบบ.

### Phase M — cleanup + hardening
- Delete the dead MC components + dead driver components + `/superadmin/organizations`.
- RLS **write** policies (plan `927`, Phase 4b).
- Migrate `vercel.json` to modern config (user sets Root Directory = `apps/web`).
- Set the missing Vercel env vars.
- `driver_issue_reports` resolve flow + real unread state for the FleetBoard badge.
- Strip remaining test-mode copy.

### Phase N — mobile app
- EAS build `apps/mobile-driver` (needs Expo login).
- Responsive audit of every driver component (320 px → tablet), safe-area, large text.

### Phase O — ops depth (4b / 5b)
- `<UndoToast>` + optimistic rollback on assign/publish/cancel.
- `<ReadinessGate>` + `<ChangeRequestButton>` wired; `/changes` page.
- Role-matrix editor.
- Command palette (⌘K) for quick nav/actions.

### Phase P — testing / CI
- Playwright E2E: login→project, dispatch→QR→PIN, driver preflight→GPS→status→centre.
- GitHub Actions: typecheck + lint + test + build on PR.
- `scripts/ui-smoke.mjs` device-matrix screenshotter for the driver screens.

---

## Suggested order
**L → M → N → P → O.** L fixes the loudest complaint; M pays down the debt L
uncovers; N unblocks real background GPS; P protects everything before O adds
surface area.
