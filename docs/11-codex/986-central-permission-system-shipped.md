# 986 — Central permission system: shipped, verified locally, and what's still open

**Date:** 2026-09-19
**Status:** implementation complete on branch `worktree-central-permission-system` (14 build tasks + this
wrap-up task, 15 total), full local verification clean, **not yet deployed, not yet applied to production
Supabase**.
**Supersedes:** `docs/11-codex/984-central-permission-system-design.md`'s "Next step" section and
`docs/11-codex/985-airport-transfer-project-entity-and-handoff.md`'s Part A "ready for writing-plans" status
— both are now built. Read this file instead for what's next.
**Ledger of record:** `.superpowers/sdd/2026-09-18-central-permission-system/progress.md` in this worktree —
every claim below about what a review caught, what was deferred, and why, traces back to a line in that
file. This document summarizes it; that file is the ground truth if the two ever disagree.

---

## Before this ships — read this section first

This worktree has **no database credentials and no deployed environment**. Nothing below was applied to or
verified against a live database. Whoever has production Supabase credentials must, in order:

1. `node scripts/apply-migrations.mjs` — applies `0043` through `0047` in order (filenames below).
2. `node scripts/sync-supabase-migrations.mjs` — mirrors them into the Supabase-managed migration history.
3. `node scripts/apply-migrations.mjs --dry-run` — confirm nothing is left pending.
4. `node scripts/verify-schema.mjs` — confirm the live schema matches what the migrations describe.

None of steps 1–4 have been run by this implementation. Step 1's task brief originally asked for the
dry-run and verify-schema to be run here too; both were skipped because this worktree cannot reach any
database — see the adapted-execution note at the top of `task-15-brief.md`.

**Two migrations need real data verification, not just a read of the migration file's own logic:**

- **`0044_airport_transfer_project_scoping.sql`** backfills the 7 live, project-less
  `airport_transfer_cases` rows onto one newly created project (per `985`'s "Existing live data" section).
  Confirm after apply that all 7 landed correctly and none were silently skipped or double-counted — this
  worktree has never seen live data, only the migration's own SQL.
- **`0047_create_project_command_systems.sql`** changes `create_project_command()`'s signature to accept
  which systems a new project uses. Task 14's own review found and fixed a real bug in this exact migration
  (below) — confirm the fixed version behaves correctly against a live call, not just against the unit test
  added for it.

Only after all four steps are clean and both flagged migrations are spot-checked against real rows should
`vercel --prod --yes` ship this. And even then — see "The coordinated mobile-app dependency" below — do not
ship without the mobile app change landing in the same deploy.

---

## What shipped

### Database (migrations `0043`–`0047`, `apps/web/supabase/migrations/`)

- **`0043_central_permission_foundation.sql`** — the `systems` registry (two rows: `ground_transfer`,
  `airport_transfer`), `project_members.system_key` (generalizing membership across systems instead of a
  separate table), and the widened unique constraint `(project_id, system_key, profile_id)`.
- **`0044_airport_transfer_project_scoping.sql`** — `airport_transfer_cases.project_id`, the
  `airport_transfer_audit_logs.case_id` / `airport_transfer_import_rows.imported_case_id` FK fix from
  `ON DELETE SET NULL` to `ON DELETE CASCADE` (closing the PII-orphan gap `985` identified), and the
  legacy-case backfill onto one project.
- **`0045_project_manage_members_permission.sql`** — the new `project.manage_members` permission, scoped
  per-project like `assignment.update` already is, closing the dangling `/superadmin/users` link that never
  worked for a `project_manager` looking at their own project.
- **`0046_project_helper_tokens.sql`** — the `project_helper_tokens` table backing the QR/PIN grant path.
- **`0047_create_project_command_systems.sql`** — `create_project_command()` gains a `p_system_keys`
  parameter so project creation can choose which systems (Ground Transfer, Airport Transfer, or both) a new
  project uses.

### Application layer

- **Layer 3 task-ownership enforcement** — `airport_transfer_tasks.owner_role` (previously written at
  case-creation time but never checked by anything) now gates task completion: `access.canManage` (admin/
  dispatcher) still does everything, or the actor's own project-scoped role must equal the task's
  `owner_role`. `airport_coordinator`, `airport_driver`, `airport_viewer` get real, distinct behavior for
  the first time.
- **Project-scoped Airport Transfer access** — every Airport Transfer read/write now scopes through the
  case's `project_id` and the actor's `project_members` role on that project, closing a real cross-project
  data leak Task 8 found along the way (Supabase reads there run service-role, bypassing RLS — the app
  layer was the only enforcement point and previously wasn't scoping by project at all).
- **Project-code-first URL restructure**, both facets:
  - System-wide pages that aren't about any one project stay under `/ground-transfer/**` and
    `/airport-transfer/**` (token-resolved driver/fleet/track pages, Airport Transfer's provider settings).
  - Everything scoped to one engagement moved under `/projects/<project_code>/ground-transfer/**` and
    `/projects/<project_code>/airport-transfer/**`. The old bare TOMP paths (`/assignments`,
    `/mission-control`, `/resources` the project-scoped sense, `/project`) are gone with no redirect kept —
    deliberate, per `984`.
- **The outer three-tab shell** — every project page now renders under Ground Transfer / Airport Transfer /
  Settings tabs, each system tab locked-but-visible when the project hasn't enabled that system or the
  viewer can't enter it.
- **The Settings tab**, one shared member list across both systems, with two grant paths:
  - **Full account** — email, name, phone; ordinary invite-and-accept flow.
  - **Project-helper QR/PIN** — a no-email `profiles` row plus a reusable, revocable QR/PIN that lands the
    holder directly on a role-scoped view, skipping the account login/landing flow entirely. **This path
    went through significant security hardening mid-implementation — see below, don't skip it.**
- **The landing page** (`/`) — one tile per system, always visible, locked if the account holds no
  `project_members` row for that system anywhere (`super_admin` bypasses and sees everything unlocked).
  Replaces the old unconditional `redirect("/projects")`.
- **`/permission`** — platform-wide oversight (`/permission/projects`, `/permission/audit`,
  `/permission/roles`), replacing `/superadmin`'s equivalent pages, viewing-only — granting always happens
  from a project's own Settings tab now, never from a separate top-level form.
- **System-aware project creation** — the "สร้างโครงการ" form now has a systems checklist; the creator's own
  top role is granted per system they select, not just Ground Transfer unconditionally (this exact
  unconditional assumption is what Task 14's bug, below, broke).

Full per-task detail — including every review round, every fix loop, and the reasoning behind each — is in
`.superpowers/sdd/2026-09-18-central-permission-system/progress.md`. Task 15 (this task) did not
re-derive any of it; the summary above is a compression of that ledger, not independent research.

---

## Full local verification (this task, 2026-09-19)

Run from repo root in this worktree, no live database involved:

| Command | Result |
|---|---|
| `npm run typecheck` | clean, 0 errors |
| `npm run lint` | clean, 0 errors/warnings |
| `npm run test` | clean — `@tomp/web`: 54 files / 265 tests passed; `@tomp/driver-core`: 6 files / 38 tests passed (303 total) |
| `npm run build` | clean — `next build` compiled and generated all 48 static/dynamic routes with no errors |

All four are green after 14 individually-reviewed tasks composed together — this is exactly the integration
check this final task exists to run, and nothing broke across the seams.

**Not run, and cannot be run from this worktree** (no DB credentials, no deployed environment):
`node scripts/apply-migrations.mjs --dry-run`, `node scripts/verify-schema.mjs`, and the full manual smoke
pass the original task brief's Step 2 describes (log in as a Ground-Transfer-only account, confirm the
locked/unlocked tiles, toggle on Airport Transfer from `/permission`, grant a test account, issue a
project-helper QR, confirm the old bare `/driver` path 404s, etc.). Treat the brief's Step 2 as the manual
verification checklist for whoever deploys this — it was written as a set of instructions to execute, not
executed here, and steps 1–4 above are useless without it also being walked through by hand once a
deployment exists to test against.

---

## The coordinated mobile-app dependency (not resolved here — document only)

`apps/mobile-driver` is out of scope for this plan, but three call sites there still build URLs against the
**old bare `/driver` path**, and this plan's URL restructure deliberately keeps no redirect at that old
path. All three must be updated to `/ground-transfer/driver/${token}` **in the same deploy** this ships in,
or every driver using the mobile app loses their web view the moment this goes live:

- `apps/mobile-driver/src/config.ts:32` — `buildDriverWebUrl()` itself:
  `` `${TOMP_WEB_ORIGIN}/driver/${encodeURIComponent(token)}?...` ``
- `apps/mobile-driver/src/services/driver-link.ts:59` — `isTompDriverWebUrl()` checks
  `url.pathname === "/driver" || url.pathname.startsWith("/driver/")`
- `apps/mobile-driver/src/services/webview-navigation.ts:19` — `decideWebViewNavigation()` allow-lists the
  same `"/driver"` / `"/driver/"` prefix for in-app navigation

Found during Task 6's review (the first two were already flagged by the design doc; the implementer found
the third while tracing the web-view navigation allow-list). None of the three have been touched by this
plan — `apps/mobile-driver/**` is owned by the mobile track, not this one (see `978`/`979`/`980` for that
track boundary). Whoever schedules this release needs to coordinate both deploys together.

---

## Every parked or deferred item from the ledger

Organized for triage. Nothing here was fixed by this task — it's a transcription of what each task's review
surfaced and explicitly chose not to fix in-scope, in the ledger's own words where it matters.

### Needs a product or security decision

- **TOMP_SCOPED_READS / project-code enumeration** (flagged during Task 7's review). Not a regression from
  this plan — pre-existing: with `TOMP_SCOPED_READS` off, reads run service-role, so any signed-in user can
  open any project by guessing its code, same as they previously could by guessing its old UUID. But
  code-first URLs make this *practically* more exploitable, since project codes are short and memorable
  (e.g. `TOMP-2026-001`) where UUIDs weren't guessable by hand. The reviewer's own suggested fixes: flip
  `TOMP_SCOPED_READS` on, or add a membership check in the new Ground Transfer layout (a natural
  chokepoint reached by all 4 of its pages). Needs the product/security owner's decision, not a code fix
  buried in a later task.
- **`project_manager` is on the helper-QR grantable-role allowlist** (flagged during Task 10/11's review,
  both the fix-round re-reviewer and the completion review). This means a PIN-only, no-email "project
  helper" profile can be granted `project_manager` and unlock the full Ground Transfer operation view,
  including live driver GPS. The reviewer's words: "worth a deliberate product decision" — not flagged as
  obviously wrong, since there may be a legitimate case for a no-email project manager, but nobody has
  actually decided this is intended.

### Pre-existing, not introduced or swept by this plan

- **The same `.ilike("email", ...)` wildcard bug** fixed in this plan's own new code (Task 10/11's
  Critical/Important fix round replaced it with an exact-match lookup in the new grant actions) **still
  exists, unfixed, in `apps/web/lib/superadmin/users.ts:120`**:
  `client.from("profiles").select("id").ilike("email", input.email).maybeSingle()`. Zod's email validator
  permits `_`, which is a SQL `LIKE` wildcard — a crafted address can match a different person's profile.
  Confirmed still present in this worktree as of this task. Not part of any of the 14 tasks' file lists,
  not swept.

### Structural, needs manual upkeep

- **Three independent copies of the same `super_admin` gate**, confirmed still present as three separate
  files as of this task:
  - `apps/web/app/(app)/permission/layout.tsx`
  - `apps/web/app/(app)/ground-transfer/superadmin/layout.tsx`
  - `apps/web/app/(app)/superadmin/layout.tsx`

  Each is its own ~10-line verbatim copy of the same gate logic (Task 13's review, confirmed by Task 13's
  own implementer note about why the Ground Transfer copy exists — moving dev-tools out from under
  `/superadmin` without adding its own gate would have silently dropped auth entirely, since dev-tools pages
  have no gate of their own and relied on inheriting the parent's). These three need to stay in sync by
  hand if this gate logic ever changes — no shared helper extracts it.
- **`@tomp/config` / `@tomp/driver-core` vitest resolution-alias gap** (Task 14). This worktree has no
  `node_modules` of its own, so without an alias, vitest's module resolution for workspace packages climbs
  to the *main checkout's* copy instead of this worktree's edited one. This was already fixed for
  `@tomp/types` in `vitest.config.ts` (the first task to edit `packages/types/schemas.ts` hit it and fixed
  it), but the same alias was never added for `@tomp/config` or `@tomp/driver-core`. Confirmed via git log
  that no task before 14 touched `packages/**`, so this was inert and harmless throughout — it will bite
  silently (tests passing against stale main-checkout code without any error) the first time a future task
  edits either of those two packages and adds a test that exercises the change.

### Missing UI surface

- **No in-module nav link to Airport Transfer's imports/trash pages** (Task 8). The old `AirportTransferShell`
  tab bar provided this; it was removed when those pages moved under the new project-scoped structure.
  Reachable only by typed URL now. Not covered by any of the 3 findings Task 8's review caught, and Task 9's
  outer tab shell is a different (system-switcher) concern that doesn't cover it either — confirmed by Task
  9's own review. Someone should decide whether Airport Transfer needs its own
  `ProjectWorkspaceTabs`-equivalent for these two pages.

### Minor / cheap, deferred as low-stakes

- `getProjectByCode` isn't `cache()`-wrapped (Task 9) — called 2-3 times per request across the 3 nested
  layouts (outer, ground-transfer inner, airport-transfer inner). Cheap fix, optional.
- `data-quality.ts:88`'s `revalidatePath` (Task 7) could be narrowed to the specific project codes already
  in scope instead of revalidating broadly — low-stakes, it's a superadmin tool.
- `project_code` has no charset restriction in `packages/types/schemas.ts` (Task 7) and is interpolated
  unencoded into URLs in roughly 7 places, while one sibling path does `encodeURIComponent` it —
  inconsistent. Cheap fix: tighten the zod schema to `/^[A-Za-z0-9._-]+$/`.
- `vehicle-task-card.tsx` (Task 7) silently drops its "เปิดบอร์ดงาน" button when `task.project` is
  unresolved, with no explanation shown to the operator.
- Two explanatory code comments were lost in file moves during Task 7 (the resources page's "one page two
  modes" header, project-resources empty-state's "starts empty by design" note) — never re-added.
- Task 10/11: no `revalidatePath` on the 3 grant actions; duplicated `generateTempPassword`; dead
  `revokeProjectHelperToken` (no caller/UI); non-transactional orphan profile possible on
  `issueProjectHelperAction` partial failure; shallow token test coverage (wrong-token/revoked-status paths
  not covered); should use `timingSafeEqual` more generally, not just where the fix round added it;
  roleKey-vs-systemKey mismatch not validated (e.g. `airport_admin` is technically grantable under a
  `ground_transfer` grant flow — no cross-check).
- Task 10/11: `resolveHelperMembership()` has the same multi-row-`.maybeSingle()` fragility that Task 1's
  `system_key` schema change introduced elsewhere (see Important 6 below) — currently unreachable / fails
  closed, but same underlying class of bug.
- Task 10/11: the PIN attempt counter is non-atomic — a race allows more than 5 tries under concurrency.
  Matches pre-existing behavior in `lib/domain/driver-pin-lock.ts`; not a regression introduced here.
- Task 7: overview page's `AccessDenied` branch is dead code — `layout.tsx`'s `notFound()` fires first, so a
  non-member sees a bare 404 instead of the intended "contact your project manager" copy. The brief itself
  asked for both behaviors, which is a contradiction in the brief, not an implementer slip.

---

## The security hardening that happened mid-implementation (Task 10/11)

Worth recording explicitly rather than leaving it implicit in a ledger line, since this is exactly the kind
of thing a future auditor should be able to find: the project-helper QR/PIN grant path, as specified by
this plan's own brief, shipped its first draft with **3 Critical vulnerabilities**, all caught by code
review before merge, none of them ever live:

1. **Unvalidated role escalation to platform `super_admin`.** `addProjectMemberAction` /
   `issueProjectHelperAction` accepted an unvalidated `roleKey` string. Because the `roles` table has a
   `super_admin` row and `getUserRoles()` unions *all* of a profile's project-membership roles into its
   global role set, a `project_manager` could call the action with `roleKey: "super_admin"` and become a
   platform super admin in one call. The client-side dropdown was not a real gate — the server action
   itself did no validation.
2. **Unthrottled PIN brute-force.** Helper PIN verification had zero rate-limiting or lockout — trivially
   brute-forceable across a 4-digit space. The repo already has `lib/domain/driver-pin-lock.ts` solving
   exactly this problem for the driver-PIN flow; the new helper flow didn't reuse it.
3. **Unsalted, unpeppered PIN hash readable via RLS.** The PIN was hashed with the same plain
   `sha256`-based `hashToken()` used for the token itself. Any active project member can read
   `project_helper_tokens.metadata` via RLS, so the PIN was recoverable by direct table lookup. The
   driver-PIN precedent (`lib/driver-access/token.ts`) pepper-hashes with a required production secret plus
   `timingSafeEqual`; this new code didn't follow that precedent.

All three were fixed in the first fix round and independently re-verified correct by the re-reviewer —
along with 5 more Important-severity findings from the same review (unscoped RLS grant on
`project_helper_tokens`, the helper claim page not being role-scoped as designed, a pre-existing
`getProjectMembership()` fragility that this plan's own schema change made newly reachable, an
account-wide-instead-of-project-scoped permission check on the Settings page's entry gate, and the
`.ilike` email bug mentioned above). Task 10/11's own ledger entry calls this "the highest-severity fix
work in the whole plan" — 3 Critical security defects genuinely closed and independently re-verified,
not shipped and not silently absent from this record.

---

## Where to look next

- Full task-by-task history, every review round, every fix loop:
  `.superpowers/sdd/2026-09-18-central-permission-system/progress.md`
- The design docs this plan implements: `984` (the systems registry, three layers, granting model,
  URL structure, `/permission`) and `985` (the shared-project model, `project_systems`, the deferred
  Ground-Transfer handoff in its Part B).
- The Airport Transfer audit that started this whole thread: `983`.
