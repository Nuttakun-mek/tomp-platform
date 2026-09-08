# RBAC Phase 5 (part A) — Superadmin depth Implementation Plan

> superpowers:executing-plans — task-by-task, verify, ไม่ push จนกว่าจะ review.

**Goal:** ให้ทีมแพลตฟอร์มมองเห็น + จัดการ role/permission, องค์กร, โครงการข้าม org, และ audit trail ข้ามโครงการ จากในพื้นที่ `/superadmin`

**Architecture:** เพจ read-first ใต้ `/superadmin/*` (layout gate `super_admin` อยู่แล้ว) · data ผ่าน service-role client (`lib/superadmin/overview.ts`) เพราะ superadmin ต้องเห็นข้าม scope · เพิ่ม 4 แท็บใน `SuperadminShell`

**Tech Stack:** RSC · service-role Supabase client · design-system tokens · vitest

## Global Constraints

- ทุกหน้าใต้ `/superadmin` — layout gate เช็ค `super_admin` แล้ว ไม่ต้องเช็คซ้ำในเพจ
- ใช้ `getSupabaseServerDataClient()` (service-role) — ไม่ใช่ scoped client
- raw enum ห้ามหลุด — ใช้ `formatStatusTh`, `roleLabelTh`, `formatTimelineEventTh`
- typecheck + lint + test เขียวทุก task; build หยุด dev ก่อน
- Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `apps/web/lib/superadmin/overview.ts` (+ `.test.ts` เฉพาะ pure) | `listRolePermissionMatrix()`, `listOrganizationsWithCounts()`, `listAllProjects()`, `listRecentAuditEvents(limit)` |
| `apps/web/components/superadmin/superadmin-shell.tsx` | + 4 แท็บ (บทบาท, องค์กร, โครงการ, บันทึกกิจกรรม) |
| `apps/web/app/superadmin/roles/page.tsx` | role × permission matrix |
| `apps/web/app/superadmin/organizations/page.tsx` | org list + นับ project/member |
| `apps/web/app/superadmin/projects/page.tsx` | project ทุก org + org name + lifecycle + member count |
| `apps/web/app/superadmin/audit/page.tsx` | timeline ข้ามโครงการ (ล่าสุด 100) |
| `apps/web/components/superadmin/role-matrix.tsx` | grid ✓ |
| `apps/web/components/superadmin/audit-feed.tsx` | list event + actor + เวลา |

---

## Task 32 — `lib/superadmin/overview.ts`

**Files:** Create `apps/web/lib/superadmin/overview.ts`, `apps/web/lib/superadmin/overview.test.ts`

**Produces:**
```ts
export interface RoleMatrixRow { roleKey: string; permissionKeys: string[]; }
export function buildRoleMatrix(rows: Array<{ role_key: string; permission_key: string }>): { roles: string[]; permissions: string[]; grid: Record<string, Set<string>> }
export async function listRolePermissionMatrix(): Promise<{ roles: string[]; permissions: string[]; grid: Record<string, string[]> }>
export interface OrgRow { id: string; name: string; status: string; projectCount: number; memberCount: number; }
export async function listOrganizationsWithCounts(): Promise<OrgRow[]>
export interface AdminProjectRow { id: string; projectCode: string; projectName: string; status: string; organizationName: string; memberCount: number; ownerName: string | null; }
export async function listAllProjects(): Promise<AdminProjectRow[]>
export interface AuditRow { id: string; projectName: string; eventType: string; objectType: string; actorName: string | null; reason: string | null; createdAt: string; }
export async function listRecentAuditEvents(limit?: number): Promise<AuditRow[]>
```

- [ ] **Step 1: test `buildRoleMatrix`** (pure)

```ts
const rows = [
  { role_key: "dispatcher", permission_key: "assignment.read" },
  { role_key: "dispatcher", permission_key: "assignment.create" },
  { role_key: "planner", permission_key: "assignment.read" }
];
const m = buildRoleMatrix(rows);
expect(m.roles).toEqual(["dispatcher", "planner"]);
expect(m.permissions).toEqual(["assignment.create", "assignment.read"]); // sorted
expect(m.grid.dispatcher.has("assignment.create")).toBe(true);
expect(m.grid.planner.has("assignment.create")).toBe(false);
```

- [ ] **Step 2: implement `buildRoleMatrix`** — roles = unique sorted role_key; permissions = unique sorted permission_key; grid[role] = Set of permission_key

- [ ] **Step 3: implement async fns** — service-role client:
  - `listRolePermissionMatrix`: `role_permissions` select `roles(role_key), permissions(permission_key)` → `buildRoleMatrix` → grid เป็น string[] (จาก Set)
  - `listOrganizationsWithCounts`: `organizations` select id,name,status; แล้ว `projects` group count + `project_members`... ใช้วิธีดึงทั้งหมดแล้วนับใน JS (dataset เล็ก)
  - `listAllProjects`: `projects` select `id, project_code, project_name, status, organization_id, owner_profile_id, organizations(name)`; `project_members` count ต่อ project (ดึง project_id ทั้งหมดแล้วนับ); owner จาก `profiles`
  - `listRecentAuditEvents`: `timeline_events` select `id, event_type, object_type, actor_id, reason, created_at, project_id, projects(project_name)` order created_at desc limit; actor name จาก `profiles` map
  - ทุกฟังก์ชัน: `if (!client) return []` / เหมาะสม

- [ ] **Step 4: verify** typecheck + lint + `vitest run lib/superadmin` — เขียว

- [ ] **Step 5: commit** `feat(superadmin): overview data layer (role matrix, orgs, projects, audit)`

---

## Task 33 — `/superadmin/roles` + shell tab

**Files:** Create `apps/web/app/superadmin/roles/page.tsx`, `apps/web/components/superadmin/role-matrix.tsx`; Modify `apps/web/components/superadmin/superadmin-shell.tsx`

- [ ] **Step 1: shell tabs** — เพิ่มใน `TABS`: `{ href: "/superadmin/roles", label: "บทบาท" }`, `{ href: "/superadmin/organizations", label: "องค์กร" }`, `{ href: "/superadmin/projects", label: "โครงการ" }`, `{ href: "/superadmin/audit", label: "บันทึกกิจกรรม" }`

- [ ] **Step 2: `<RoleMatrix>`** — props `{ roles: string[]; permissions: string[]; grid: Record<string, string[]> }` → ตาราง scroll แนวนอน (`overflow-x-auto`): แถวแรก = permission key (เอียง/เล็ก), คอลัมน์แรก sticky = `roleLabelTh(role)` + `<code>{role}</code>`, เซลล์ = `Check` เขียว ถ้ามี, `–` จาง ถ้าไม่มี; `*` (wildcard) แสดงเป็นแถวเต็มเขียว "ทุกสิทธิ์"

- [ ] **Step 3: `page.tsx`** — `listRolePermissionMatrix()` → `<PageHeader eyebrow="ทีมแพลตฟอร์ม" title="บทบาทและสิทธิ์" description="เมทริกซ์บทบาท × สิทธิ์ จาก role_permissions ใน DB (source of truth)" />` + `<RoleMatrix>`; ถ้า `roles` ว่าง → `<EmptyState>`

- [ ] **Step 4: verify** typecheck + lint + test + `curl /superadmin/roles` = 200

- [ ] **Step 5: commit** `feat(superadmin): /superadmin/roles — role × permission matrix`

---

## Task 34 — `/superadmin/organizations`

**Files:** Create `apps/web/app/superadmin/organizations/page.tsx`

- [ ] **Step 1: `page.tsx`** — `listOrganizationsWithCounts()` → `<PageHeader>` + `data-table` หรือ `.smart-card` grid: ชื่อ org · `formatStatusTh(status)` · `projectCount` โครงการ · `memberCount` สมาชิก; `<EmptyState>` ถ้าว่าง

- [ ] **Step 2: verify** typecheck + lint + `curl` = 200

- [ ] **Step 3: commit** `feat(superadmin): /superadmin/organizations`

---

## Task 35 — `/superadmin/projects`

**Files:** Create `apps/web/app/superadmin/projects/page.tsx`

- [ ] **Step 1: `page.tsx`** — `listAllProjects()` → table: `projectCode · projectName` (ลิงก์ `/projects/{id}`) · `organizationName` · `formatStatusTh(status)` · `ownerName ?? "ยังไม่ระบุ"` · `memberCount`; `<EmptyState>` ถ้าว่าง

- [ ] **Step 2: verify** typecheck + lint + `curl` = 200

- [ ] **Step 3: commit** `feat(superadmin): /superadmin/projects — cross-org project list`

---

## Task 36 — `/superadmin/audit`

**Files:** Create `apps/web/app/superadmin/audit/page.tsx`, `apps/web/components/superadmin/audit-feed.tsx`

- [ ] **Step 1: `<AuditFeed>`** — props `{ rows: AuditRow[] }` → list: `formatTimelineEventTh(eventType)` (fallback raw) · โครงการ · actor (`actorName ?? "ระบบ"`) · `formatRelativeTh(createdAt)` · `reason` ถ้ามี. Empty → `<EmptyState>`

- [ ] **Step 2: `page.tsx`** — `listRecentAuditEvents(100)` → `<PageHeader eyebrow="ทีมแพลตฟอร์ม" title="บันทึกกิจกรรม" description="ไทม์ไลน์กิจกรรมล่าสุดข้ามทุกโครงการ" />` + `<AuditFeed>`

- [ ] **Step 3: verify** typecheck + lint + test + `curl` = 200

- [ ] **Step 4: commit** `feat(superadmin): /superadmin/audit — cross-project activity feed`

---

## Task 37 — regression + handoff

- [ ] **Step 1:** typecheck + lint + test + build เขียว
- [ ] **Step 2:** screenshot `/superadmin/roles`, `/superadmin/projects`, `/superadmin/audit`
- [ ] **Step 3:** handoff `932-rbac-phase-5a-done.md` + อัปเดต `922`
- [ ] **Step 4:** commit `docs: Phase 5a done — superadmin depth`

---

## เลื่อนต่อ (Phase 5b)

- role matrix **แก้ไขได้** (toggle → write `role_permissions`) — read-only ก่อน
- `/superadmin/organizations` CRUD, `/superadmin/projects` member management
- `/coordinator`, `/vendor`, `/changes` เต็มรูปแบบ
- RLS write policies, command palette, `<UndoToast>` toast system

## Self-review

- `buildRoleMatrix` เป็น pure → test ใน node env ได้; async fns ไม่ต้อง unit test (integration ผ่าน curl)
- ทุกเพจใหม่ = server component, ไม่มี client state → ไม่ต้อง "use client"
- `formatTimelineEventTh` — เช็คว่า export ชื่อนี้จริงใน `lib/i18n/timeline-th.ts` (อาจชื่อ `timelineEventLabelTh`)
