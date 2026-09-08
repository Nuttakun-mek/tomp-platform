# Phase L — project-centric IA

User: login → project list (create/archive) → *enter* a project → that project's
tools; projects don't share data.

## Done

### Navigation
- `nav-model.ts` — the whole "ปฏิบัติการ" + "วางแผน" sections collapse to one item:
  **โครงการ** (`/projects`). No more standalone ภาพรวม / ศูนย์ควบคุม / จัดงาน / ทรัพยากร
  in the sidebar. `role-model.ts` — `super_admin` now redirects to `/projects` too;
  `/` redirects to `/projects`.
- `<ProjectWorkspaceTabs>` — a tab bar (ภาพรวม · จัดงาน · ศูนย์ควบคุม · ทรัพยากร ·
  ตั้งค่า) with a "← โครงการทั้งหมด" link, rendered at the top of every project-scoped
  page. This is the in-project nav.

### `/projects` — the home
Card grid of accessible projects (active / archived toggle). Each card: code, name,
status, dates, **เข้าโครงการ** + **เก็บถาวร** (managers). **สร้างโครงการ** button +
a quick inline create form. Empty states per role.

### `/project?projectId=&tab=` — the workspace hub
- **Guard**: `getProjectById` null → `<AccessDenied>` (the Phase F guard now actually
  runs — production serves this page, not the shadowed `/projects/[projectId]`).
- `tab=overview` (default): readiness, assignment board, publish, missions, changes.
- `tab=settings`: rename (`renameProjectAction`), member list
  (`getProjectMembers` → `project_members` + profiles + roles), archive / restore.
- `/projects/[projectId]` and `/projects/[projectId]/assignments` are now redirect
  shims to `/project?projectId=` / `/assignments?projectId=` (dev == prod; the
  `vercel.json` rewrites already point prod at the singular pages).

### Tool pages are project-scoped
- `/mission-control` and `/assignments`: **must** have `?projectId=`. No param →
  redirect to that project if there's exactly one, else to `/projects`. Removed the
  in-page project switcher/`<ProjectSwitcher>`. `<ProjectWorkspaceTabs>` at the top.
- `/resources`: shows the tabs when `?projectId=` is present (drivers/vehicles are a
  shared pool by design).

### Actions
- `archiveProjectAction({ projectId, restore? })` — `status='archived'` / `'planning'`,
  `project.update` perm, timeline event.
- `renameProjectAction({ projectId, projectName })`.

## Verify
typecheck 0 · lint 0 · web 54/15 · driver-core 14/5 · build `LBUILD=?` · `smoke:production`.

## Follow-ups (Phase M)
- `<ProjectScopePill>` in the sidebar is now redundant with the tabs — reconcile.
- Dead: `<ProjectSwitcher>`, `project-summary-card`, `project-list`,
  `getProjectIdWithLatestDriverLocation`, `<CommandHeader>` on `/`.
- Per-project "add existing user as member" action (settings currently links out to
  `/superadmin/users`).
