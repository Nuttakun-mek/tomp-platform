# RBAC Restructure — Phase 0 + Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้ระบบ resolve บทบาทผู้ใช้จริง, พา user ไปหน้าที่เหมาะกับบทบาทหลัง login, และซ่อนเมนู/หน้าที่ไม่มีสิทธิ์ — โดยยังไม่แตะ data scoping (Phase 3)

**Architecture:** แยก "pure logic" (role ranking, redirect map, nav filter — unit-tested ด้วย vitest) ออกจาก "IO" (อ่าน DB profiles/roles/permissions ผ่าน session client). `role_permissions` ย้ายจาก hardcoded map เข้า DB (มี fallback). App shell เรียก `getViewerAccess()` ครั้งเดียว แล้วส่ง `permissions`/`roleKeys` ลงไปให้ nav + guard components.

**Tech Stack:** Next.js 15 (App Router, RSC + server actions), Supabase Auth (`@supabase/ssr`), Postgres RLS, vitest (node env, `lib/**/*.test.ts`), Tailwind, lucide-react

## Global Constraints

- Node `>=20`; ห้าม downgrade dependency
- Thai UI copy ตาม `docs/05-ux/505-thai-copy-guideline.md`: action verbs (เปิด/ตรวจ/สร้าง/ยืนยัน), missing = "ยังไม่ระบุ", risk = "ต้องติดตาม", ห้ามเคลม production-ready
- English เฉพาะ: TOMP, Call Sign, QR, GPS, Google Maps, Mission Control — ต้องคู่กับบริบทไทย
- ทุก commit จบด้วย: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- ทำงานบน branch `fix/pilot-stability-followup` (ต่อจาก commit `24dedeb`) — ไม่ push จนกว่าจะ review
- verify ทุก task: `npm run typecheck && npm run lint && npm test` เขียว
- **ห้ามแตะ** `lib/data/*` (Phase 3), RLS policies (Phase 3), `/driver*`, `/api/driver*`
- 0 horizontal overflow ทุก breakpoint (คงจาก `72e822b`); ใช้ token/utility จาก `globals.css` (`.page-title`, `.section-label`, `.enterprise-panel`, `rounded-panel`, `text-ink`/`text-ink-soft`/`operation`)
- dev fallback (`isDevelopmentFallback`) ต้อง**ยังใช้งานได้** — dev ที่ไม่มี Supabase session ต้องเปิดเว็บได้ (role = `super_admin` ใน dev)

---

## File Structure

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `apps/web/lib/auth/role-model.ts` | pure: อันดับ role, primary role, redirect map | สร้าง |
| `apps/web/lib/auth/role-model.test.ts` | unit test ของ role-model | สร้าง |
| `apps/web/lib/auth/nav-model.ts` | data: โครงสร้าง nav + `filterNav()` pure | สร้าง |
| `apps/web/lib/auth/nav-model.test.ts` | unit test ของ nav filter | สร้าง |
| `apps/web/lib/auth/permissions.ts` | เพิ่ม DB loader + คง `roleHasPermission` | แก้ |
| `apps/web/lib/auth/permissions.test.ts` | เพิ่มเคส wildcard/unknown | แก้ |
| `apps/web/lib/auth/access.ts` | IO: `getViewerAccess()` — profile+roleKeys+permissions+primaryRole | สร้าง |
| `apps/web/lib/auth/current-user.ts` | resolve roleLabel จริง + auto-link invited profile | แก้ |
| `apps/web/app/auth/callback/route.ts` | exchange code → resolve → redirect ตาม role | แก้ |
| `apps/web/app/no-access/page.tsx` | หน้าไม่มีสิทธิ์ | สร้าง |
| `apps/web/components/auth/access-denied.tsx` | `<AccessDenied>` reusable | สร้าง |
| `apps/web/components/auth/permission-gate.tsx` | `<PermissionGate>` server component | สร้าง |
| `apps/web/components/auth/role-badge.tsx` | `<RoleBadge>` | สร้าง |
| `apps/web/components/ui/empty-state.tsx` | `<EmptyState>` | สร้าง |
| `apps/web/components/ui/breadcrumb.tsx` | `<Breadcrumb>` | สร้าง |
| `apps/web/components/app-nav.tsx` | รับ nav ที่ filter แล้ว, regroup | แก้ (rewrite) |
| `apps/web/components/app-shell.tsx` | เรียก `getViewerAccess()`, ส่งลง nav, ลบ AuthGate | แก้ |
| `apps/web/components/auth/auth-gate.tsx` | ลบ | ลบ |
| `apps/web/lib/auth/auth-client.ts` | (คงไว้ — browser client ยังใช้ที่อื่น) | — |
| `database/migrations/0018_seed_role_permissions.sql` | seed `role_permissions` จาก matrix | สร้าง |
| `apps/web/lib/i18n/role-th.ts` | Thai label ของ role | สร้าง |

---

## Task 1: Seed `role_permissions` migration

**Files:**
- Create: `database/migrations/0018_seed_role_permissions.sql`

**Interfaces:**
- Produces: rows ใน `public.role_permissions` (role_id × permission_id) ตรงกับ `ROLE_PERMISSIONS` map ปัจจุบัน + permission ใหม่

- [ ] **Step 1: เขียน migration**

```sql
-- Seed role_permissions from the app's ROLE_PERMISSIONS matrix so the DB is the
-- source of truth. Idempotent. super_admin uses a wildcard sentinel permission.

insert into public.permissions (permission_key, permission_name)
values
  ('project.create', 'Create projects'),
  ('mission.create', 'Create missions'),
  ('mission.update', 'Update missions'),
  ('assignment.create', 'Create assignments'),
  ('driver.create', 'Create drivers'),
  ('vehicle.create', 'Create vehicles'),
  ('change.create', 'Create change requests'),
  ('change.approve', 'Approve change requests'),
  ('change.apply', 'Apply change requests'),
  ('incident.create', 'Create incidents'),
  ('incident.manage', 'Manage incidents'),
  ('recovery.manage', 'Manage recovery'),
  ('org.manage', 'Manage organization settings'),
  ('superadmin.access', 'Access superadmin area'),
  ('*', 'All permissions (wildcard)')
on conflict (permission_key) do nothing;

-- role_key -> [permission_key]
with matrix(role_key, permission_key) as (
  values
    ('super_admin', '*'),
    ('organization_admin', 'project.read'), ('organization_admin', 'project.create'),
    ('organization_admin', 'project.update'), ('organization_admin', 'mission.read'),
    ('organization_admin', 'assignment.read'), ('organization_admin', 'timeline.read'),
    ('organization_admin', 'admin.manage_users'), ('organization_admin', 'org.manage'),
    ('project_manager', 'project.read'), ('project_manager', 'project.create'),
    ('project_manager', 'project.update'), ('project_manager', 'project.publish'),
    ('project_manager', 'mission.read'), ('project_manager', 'mission.create'),
    ('project_manager', 'mission.update'), ('project_manager', 'assignment.read'),
    ('project_manager', 'assignment.create'), ('project_manager', 'assignment.update'),
    ('project_manager', 'driver.read'), ('project_manager', 'driver.create'),
    ('project_manager', 'driver.update'), ('project_manager', 'vehicle.read'),
    ('project_manager', 'vehicle.create'), ('project_manager', 'vehicle.update'),
    ('project_manager', 'timeline.read'), ('project_manager', 'timeline.create'),
    ('project_manager', 'change.create'), ('project_manager', 'change.approve'),
    ('project_manager', 'change.apply'), ('project_manager', 'incident.create'),
    ('project_manager', 'incident.manage'), ('project_manager', 'recovery.manage'),
    ('operation_manager', 'project.read'), ('operation_manager', 'mission.read'),
    ('operation_manager', 'assignment.read'), ('operation_manager', 'assignment.update'),
    ('operation_manager', 'driver.read'), ('operation_manager', 'driver.update'),
    ('operation_manager', 'vehicle.read'), ('operation_manager', 'vehicle.update'),
    ('operation_manager', 'timeline.read'), ('operation_manager', 'timeline.create'),
    ('operation_manager', 'change.create'), ('operation_manager', 'change.apply'),
    ('operation_manager', 'incident.create'), ('operation_manager', 'incident.manage'),
    ('operation_manager', 'recovery.manage'),
    ('planner', 'project.read'), ('planner', 'mission.read'), ('planner', 'mission.create'),
    ('planner', 'mission.update'), ('planner', 'assignment.read'), ('planner', 'assignment.create'),
    ('dispatcher', 'project.read'), ('dispatcher', 'mission.read'), ('dispatcher', 'assignment.read'),
    ('dispatcher', 'assignment.create'), ('dispatcher', 'assignment.update'),
    ('dispatcher', 'driver.read'), ('dispatcher', 'driver.create'),
    ('dispatcher', 'vehicle.read'), ('dispatcher', 'vehicle.create'),
    ('coordinator', 'project.read'), ('coordinator', 'mission.read'),
    ('coordinator', 'assignment.read'), ('coordinator', 'timeline.read'),
    ('coordinator', 'incident.create'),
    ('driver', 'assignment.read'),
    ('organizer', 'project.read'), ('organizer', 'mission.read'), ('organizer', 'timeline.read'),
    ('organizer', 'change.create'),
    ('customer_viewer', 'project.read'), ('customer_viewer', 'timeline.read'),
    ('vendor', 'assignment.read'), ('vendor', 'driver.read'), ('vendor', 'vehicle.read')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from matrix m
join public.roles r on r.role_key = m.role_key
join public.permissions p on p.permission_key = m.permission_key
on conflict (role_id, permission_id) do nothing;
```

- [ ] **Step 2: sync + apply local**

Run: `npm run db:local:sync && npm run db:local:reset` (local stack ต้องเปิดอยู่ — `npm run db:local:start`)
Expected: migration `0018` applied, ไม่มี error

- [ ] **Step 3: verify**

Run:
```bash
npx --prefix apps/web supabase db reset >/dev/null 2>&1; \
docker exec supabase_db_tomp-platform psql -U postgres -d postgres -tAc \
"select r.role_key, count(*) from role_permissions rp join roles r on r.id=rp.role_id group by 1 order by 1"
```
Expected: `super_admin` = 1, `project_manager` ≈ 25, `driver` = 1, ครบ 11 role

- [ ] **Step 4: apply to cloud (dry-run ก่อน)**

Run: `npm run db:migrate:dry`
Expected: `0018_seed_role_permissions.sql` ขึ้นเป็น pending

Run: `npm run db:migrate -- --yes`
Expected: applied, `db:migrate:dry` → "up to date"

- [ ] **Step 5: Commit**

```bash
git add database/migrations/0018_seed_role_permissions.sql supabase/migrations/
git commit -m "feat(rbac): seed role_permissions from app matrix

Moves the role->permission matrix into the DB as source of truth.
Adds change/incident/recovery/org/superadmin permission keys and a
'*' wildcard for super_admin. Idempotent.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `lib/auth/role-model.ts` — pure role logic

**Files:**
- Create: `apps/web/lib/auth/role-model.ts`
- Test: `apps/web/lib/auth/role-model.test.ts`

**Interfaces:**
- Produces:
  - `PRIMARY_ROLE_ORDER: readonly string[]` — เรียงจากสิทธิ์สูงสุด
  - `resolvePrimaryRole(roleKeys: string[]): string | null`
  - `resolveRedirectPath(primaryRole: string | null): string`

- [ ] **Step 1: เขียน failing test**

```ts
// apps/web/lib/auth/role-model.test.ts
import { describe, expect, it } from "vitest";
import { resolvePrimaryRole, resolveRedirectPath } from "./role-model";

describe("resolvePrimaryRole", () => {
  it("picks the highest-ranked role", () => {
    expect(resolvePrimaryRole(["dispatcher", "operation_manager"])).toBe("operation_manager");
    expect(resolvePrimaryRole(["coordinator", "planner"])).toBe("planner");
  });
  it("returns null for empty or unknown roles", () => {
    expect(resolvePrimaryRole([])).toBeNull();
    expect(resolvePrimaryRole(["made_up"])).toBeNull();
  });
  it("keeps super_admin on top", () => {
    expect(resolvePrimaryRole(["organizer", "super_admin", "dispatcher"])).toBe("super_admin");
  });
});

describe("resolveRedirectPath", () => {
  it("maps roles to their landing route", () => {
    expect(resolveRedirectPath("dispatcher")).toBe("/assignments");
    expect(resolveRedirectPath("operation_manager")).toBe("/mission-control");
    expect(resolveRedirectPath("planner")).toBe("/projects");
    expect(resolveRedirectPath("organizer")).toBe("/portal");
    expect(resolveRedirectPath("super_admin")).toBe("/");
  });
  it("sends unknown/null to /no-access", () => {
    expect(resolveRedirectPath(null)).toBe("/no-access");
    expect(resolveRedirectPath("mystery")).toBe("/no-access");
  });
});
```

- [ ] **Step 2: run — verify fail**

Run: `npm test -w @tomp/web -- role-model`
Expected: FAIL — `Cannot find module './role-model'`

- [ ] **Step 3: implement**

```ts
// apps/web/lib/auth/role-model.ts

// เรียงจากสิทธิ์สูงสุด → ต่ำสุด; ตัวแรกที่ user มี = primary role
export const PRIMARY_ROLE_ORDER = [
  "super_admin",
  "organization_admin",
  "operation_manager",
  "project_manager",
  "planner",
  "dispatcher",
  "coordinator",
  "vendor",
  "organizer",
  "customer_viewer",
  "driver"
] as const;

export type PrimaryRole = (typeof PRIMARY_ROLE_ORDER)[number];

const REDIRECT_BY_ROLE: Record<string, string> = {
  super_admin: "/",
  organization_admin: "/",
  operation_manager: "/mission-control",
  project_manager: "/projects",
  planner: "/projects",
  dispatcher: "/assignments",
  coordinator: "/coordinator",
  vendor: "/vendor",
  organizer: "/portal",
  customer_viewer: "/portal"
  // driver ไม่ redirect ผ่าน callback (ใช้ QR) — ตกไป /no-access ถ้า login ปกติ
};

export function resolvePrimaryRole(roleKeys: string[]): string | null {
  for (const role of PRIMARY_ROLE_ORDER) {
    if (roleKeys.includes(role)) return role;
  }
  return null;
}

export function resolveRedirectPath(primaryRole: string | null): string {
  if (!primaryRole) return "/no-access";
  return REDIRECT_BY_ROLE[primaryRole] ?? "/no-access";
}
```

- [ ] **Step 4: run — verify pass**

Run: `npm test -w @tomp/web -- role-model`
Expected: PASS (7 assertions)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/auth/role-model.ts apps/web/lib/auth/role-model.test.ts
git commit -m "feat(rbac): add pure role-model (primary role + redirect map)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `lib/i18n/role-th.ts` — Thai role labels

**Files:**
- Create: `apps/web/lib/i18n/role-th.ts`

**Interfaces:**
- Produces: `roleLabelTh(roleKey: string | null): string`

- [ ] **Step 1: implement (ไม่มี test — pure lookup table)**

```ts
// apps/web/lib/i18n/role-th.ts
const ROLE_LABELS_TH: Record<string, string> = {
  super_admin: "ผู้ดูแลแพลตฟอร์ม",
  organization_admin: "ผู้ดูแลองค์กร",
  operation_manager: "ผู้จัดการปฏิบัติการ",
  project_manager: "ผู้จัดการโครงการ",
  planner: "ผู้วางแผน",
  dispatcher: "ผู้จัดสรรงาน",
  coordinator: "ผู้ประสานงาน",
  driver: "คนขับ",
  organizer: "ผู้จัดงาน",
  customer_viewer: "ผู้ชมฝั่งลูกค้า",
  vendor: "ผู้ให้บริการ"
};

export function roleLabelTh(roleKey: string | null | undefined): string {
  if (!roleKey) return "ยังไม่กำหนดบทบาท";
  return ROLE_LABELS_TH[roleKey] ?? roleKey;
}
```

- [ ] **Step 2: verify build**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/i18n/role-th.ts
git commit -m "feat(i18n): Thai role labels

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `lib/auth/nav-model.ts` — nav data + pure filter

**Files:**
- Create: `apps/web/lib/auth/nav-model.ts`
- Test: `apps/web/lib/auth/nav-model.test.ts`

**Interfaces:**
- Consumes: `roleHasPermission` จาก `./permissions` (สำหรับ caller ไม่ใช่ที่นี่)
- Produces:
  - `type NavItem = { href: string; label: string; description: string; icon: string; help: string; anyPermission?: string[]; anyRole?: string[] }`
  - `type NavSection = { title: string; items: NavItem[] }`
  - `NAV_SECTIONS: NavSection[]`
  - `filterNav(sections: NavSection[], ctx: { permissions: string[]; roleKeys: string[] }): NavSection[]`

- [ ] **Step 1: เขียน failing test**

```ts
// apps/web/lib/auth/nav-model.test.ts
import { describe, expect, it } from "vitest";
import { NAV_SECTIONS, filterNav } from "./nav-model";

const flat = (sections: ReturnType<typeof filterNav>) =>
  sections.flatMap((s) => s.items.map((i) => i.href));

describe("filterNav", () => {
  it("shows only items the viewer has permission/role for", () => {
    const dispatcher = filterNav(NAV_SECTIONS, {
      permissions: ["project.read", "assignment.read", "assignment.create", "driver.read", "vehicle.read"],
      roleKeys: ["dispatcher"]
    });
    const hrefs = flat(dispatcher);
    expect(hrefs).toContain("/");
    expect(hrefs).toContain("/assignments");
    expect(hrefs).toContain("/mission-control");
    expect(hrefs).not.toContain("/superadmin");
    expect(hrefs).not.toContain("/org/members");
  });

  it("wildcard permission unlocks everything", () => {
    const superAdmin = filterNav(NAV_SECTIONS, { permissions: ["*"], roleKeys: ["super_admin"] });
    expect(flat(superAdmin)).toContain("/superadmin");
    expect(flat(superAdmin)).toContain("/org/members");
  });

  it("always shows the overview to any logged-in viewer", () => {
    const noPerm = filterNav(NAV_SECTIONS, { permissions: [], roleKeys: [] });
    expect(flat(noPerm)).toEqual(["/"]);
  });

  it("drops empty sections", () => {
    const noPerm = filterNav(NAV_SECTIONS, { permissions: [], roleKeys: [] });
    expect(noPerm.every((s) => s.items.length > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: run — verify fail**

Run: `npm test -w @tomp/web -- nav-model`
Expected: FAIL — module not found

- [ ] **Step 3: implement**

```ts
// apps/web/lib/auth/nav-model.ts

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: string; // ชื่อ lucide icon — map เป็น component ใน app-nav.tsx
  help: string;
  anyPermission?: string[]; // มีอย่างน้อย 1 ใน list นี้
  anyRole?: string[]; // หรือมี role นี้
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "ปฏิบัติการ",
    items: [
      { href: "/", label: "ภาพรวม", description: "สถานะรวมวันนี้", icon: "Gauge", help: "ดูภาพรวมโครงการ งานที่จัดสรร GPS ล่าสุด และรายการที่ต้องติดตาม" },
      { href: "/mission-control", label: "ศูนย์ควบคุม", description: "แผนที่ รถ งาน ความเสี่ยง", icon: "MapPinned", help: "ติดตามรถบนแผนที่ สถานะงาน GPS ข้อความจากคนขับ และรายการเสี่ยง", anyPermission: ["assignment.read"] },
      { href: "/assignments", label: "บอร์ด Assignment", description: "มอบงานให้รถและคนขับ", icon: "ClipboardList", help: "จัดสรรงานให้ Call Sign คนขับ และรถ พร้อมสร้าง QR เฉพาะงาน", anyPermission: ["assignment.read"] }
    ]
  },
  {
    title: "วางแผน",
    items: [
      { href: "/projects", label: "โครงการ", description: "สร้างและจัดการพื้นที่ปฏิบัติการ", icon: "FolderKanban", help: "โครงการคือพื้นที่หลักสำหรับรวมภารกิจ งานที่จัดสรร คนขับ รถ QR และ Timeline", anyPermission: ["project.read"] },
      { href: "/resources", label: "ทรัพยากร", description: "คนขับและรถ", icon: "CarFront", help: "ดูรายชื่อคนขับ รถ สถานะ และความพร้อมสำหรับรับงาน", anyPermission: ["driver.read", "vehicle.read"] }
    ]
  },
  {
    title: "ประสานงาน",
    items: [
      { href: "/coordinator", label: "งานที่ได้รับมอบหมาย", description: "ยืนยันสถานะงานในพื้นที่", icon: "UserRoundCheck", help: "รายการงานที่ได้รับ ยืนยันรถถึง ผู้โดยสารขึ้นรถ และงานเสร็จ", anyRole: ["coordinator"] },
      { href: "/portal", label: "พอร์ทัลผู้จัดงาน", description: "ภาพรวมและคำขอเปลี่ยนแปลง", icon: "PanelsTopLeft", help: "ดูสถานะโครงการที่ได้รับอนุญาต และส่งคำขอเปลี่ยนแปลง", anyRole: ["organizer", "customer_viewer"] }
    ]
  },
  {
    title: "องค์กร",
    items: [
      { href: "/org/members", label: "ผู้ใช้และสิทธิ์", description: "จัดการสมาชิกและบทบาท", icon: "Users", help: "เพิ่มผู้ใช้ กำหนดบทบาทระดับองค์กรและโครงการ", anyPermission: ["admin.manage_users"] }
    ]
  },
  {
    title: "ระบบ",
    items: [
      { href: "/superadmin", label: "Superadmin", description: "เครื่องมือแพลตฟอร์ม", icon: "ShieldAlert", help: "จัดการผู้ใช้ องค์กร บทบาท และเครื่องมือพัฒนา — เฉพาะทีมแพลตฟอร์ม", anyPermission: ["superadmin.access"], anyRole: ["super_admin"] }
    ]
  }
];

function itemVisible(item: NavItem, ctx: { permissions: string[]; roleKeys: string[] }): boolean {
  if (!item.anyPermission && !item.anyRole) return true; // เมนูสาธารณะ (เช่น ภาพรวม)
  if (ctx.permissions.includes("*")) return true;
  if (item.anyPermission?.some((p) => ctx.permissions.includes(p))) return true;
  if (item.anyRole?.some((r) => ctx.roleKeys.includes(r))) return true;
  return false;
}

export function filterNav(sections: NavSection[], ctx: { permissions: string[]; roleKeys: string[] }): NavSection[] {
  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => itemVisible(item, ctx)) }))
    .filter((section) => section.items.length > 0);
}
```

- [ ] **Step 4: run — verify pass**

Run: `npm test -w @tomp/web -- nav-model`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/auth/nav-model.ts apps/web/lib/auth/nav-model.test.ts
git commit -m "feat(rbac): nav model with pure permission filter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `permissions.ts` — DB loader with fallback

**Files:**
- Modify: `apps/web/lib/auth/permissions.ts`
- Modify: `apps/web/lib/auth/permissions.test.ts`

**Interfaces:**
- Consumes: `getSupabaseServerDataClient` จาก `@/lib/supabase/server` (service role — ยอมได้ เพราะ roles/permissions ไม่ sensitive และ Phase 3 ถึงจะ scope)
- Produces:
  - คง `ROLE_PERMISSIONS: Record<string, string[]>` (fallback), `roleHasPermission(roleKey, permissionKey): boolean`
  - เพิ่ม `loadRolePermissions(): Promise<Record<string, string[]>>` — อ่านจาก DB, fallback เป็น `ROLE_PERMISSIONS` ถ้า error/ว่าง
  - เพิ่ม `permissionsForRoles(roleKeys: string[], matrix?: Record<string, string[]>): string[]`

- [ ] **Step 1: เพิ่ม failing test**

```ts
// เพิ่มใน apps/web/lib/auth/permissions.test.ts
import { permissionsForRoles, roleHasPermission } from "../permissions";

describe("permissionsForRoles", () => {
  it("unions permissions across roles and dedupes", () => {
    const result = permissionsForRoles(["planner", "coordinator"]);
    expect(result).toContain("mission.create");
    expect(result).toContain("timeline.read");
    expect(new Set(result).size).toBe(result.length);
  });
  it("super_admin yields the wildcard", () => {
    expect(permissionsForRoles(["super_admin"])).toEqual(["*"]);
  });
  it("unknown role contributes nothing", () => {
    expect(permissionsForRoles(["nope"])).toEqual([]);
  });
});

describe("roleHasPermission edge cases", () => {
  it("wildcard grants any permission", () => {
    expect(roleHasPermission("super_admin", "anything.at.all")).toBe(true);
  });
  it("unknown role denies", () => {
    expect(roleHasPermission("ghost", "project.read")).toBe(false);
  });
});
```

- [ ] **Step 2: run — verify fail**

Run: `npm test -w @tomp/web -- permissions`
Expected: FAIL — `permissionsForRoles is not a function`

- [ ] **Step 3: implement**

```ts
// apps/web/lib/auth/permissions.ts — เพิ่มท้ายไฟล์ (คง ROLE_PERMISSIONS + roleHasPermission เดิม)

export function permissionsForRoles(roleKeys: string[], matrix: Record<string, string[]> = ROLE_PERMISSIONS): string[] {
  const out = new Set<string>();
  for (const roleKey of roleKeys) {
    for (const perm of matrix[roleKey] || []) out.add(perm);
  }
  return [...out];
}

// อ่าน role_permissions จาก DB; ใช้ fallback map ถ้าอ่านไม่ได้/ว่าง
export async function loadRolePermissions(): Promise<Record<string, string[]>> {
  try {
    const { getSupabaseServerDataClient } = await import("@/lib/supabase/server");
    const client = getSupabaseServerDataClient();
    if (!client) return ROLE_PERMISSIONS;

    const { data, error } = await client
      .from("role_permissions")
      .select("roles(role_key), permissions(permission_key)");

    if (error || !data?.length) return ROLE_PERMISSIONS;

    const matrix: Record<string, string[]> = {};
    for (const row of data as Array<Record<string, unknown>>) {
      const roleKey = (row.roles as { role_key?: string } | null)?.role_key;
      const permKey = (row.permissions as { permission_key?: string } | null)?.permission_key;
      if (!roleKey || !permKey) continue;
      (matrix[roleKey] ||= []).push(permKey);
    }
    return Object.keys(matrix).length ? matrix : ROLE_PERMISSIONS;
  } catch {
    return ROLE_PERMISSIONS;
  }
}
```

- [ ] **Step 4: run — verify pass**

Run: `npm test -w @tomp/web -- permissions`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/auth/permissions.ts apps/web/lib/auth/permissions.test.ts
git commit -m "feat(rbac): load role_permissions from DB with matrix fallback

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `lib/auth/access.ts` — `getViewerAccess()`

**Files:**
- Create: `apps/web/lib/auth/access.ts`

**Interfaces:**
- Consumes:
  - `getCurrentUserProfile` จาก `./current-user` → `{ id, isDevelopmentFallback, ... }`
  - `getUserRoles(profileId)` จาก `./rbac` → `string[]`
  - `loadRolePermissions`, `permissionsForRoles` จาก `./permissions`
  - `resolvePrimaryRole` จาก `./role-model`
- Produces:
  - `interface ViewerAccess { profile: CurrentUserProfile; roleKeys: string[]; permissions: string[]; primaryRole: string | null }`
  - `getViewerAccess(): Promise<ViewerAccess>`

- [ ] **Step 1: implement**

```ts
// apps/web/lib/auth/access.ts
import "server-only";

import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/auth/current-user";
import { loadRolePermissions, permissionsForRoles } from "@/lib/auth/permissions";
import { resolvePrimaryRole } from "@/lib/auth/role-model";
import { getUserRoles } from "@/lib/auth/rbac";

export interface ViewerAccess {
  profile: CurrentUserProfile;
  roleKeys: string[];
  permissions: string[];
  primaryRole: string | null;
}

export async function getViewerAccess(): Promise<ViewerAccess> {
  const profile = await getCurrentUserProfile();

  // dev fallback: full access, super_admin
  if (profile.isDevelopmentFallback) {
    return { profile, roleKeys: ["super_admin"], permissions: ["*"], primaryRole: "super_admin" };
  }

  if (!profile.authUserId || profile.id === "anonymous") {
    return { profile, roleKeys: [], permissions: [], primaryRole: null };
  }

  const [roleKeys, matrix] = await Promise.all([getUserRoles(profile.id), loadRolePermissions()]);
  const permissions = permissionsForRoles(roleKeys, matrix);
  return { profile, roleKeys, permissions, primaryRole: resolvePrimaryRole(roleKeys) };
}
```

- [ ] **Step 2: verify build**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/auth/access.ts
git commit -m "feat(rbac): getViewerAccess — one call for profile + roles + permissions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `current-user.ts` — real roleLabel + auto-link invited profile

**Files:**
- Modify: `apps/web/lib/auth/current-user.ts:48-68` (getCurrentUserProfile body) และ `:70-119` (bootstrap)

**Interfaces:**
- Consumes: `roleLabelTh` จาก `@/lib/i18n/role-th`, `resolvePrimaryRole` จาก `./role-model`, `getUserRoles` จาก `./rbac`
- Produces: `CurrentUserProfile.roleLabel` = Thai label ของ primary role จริง; profile ที่ `status='invited'` + email ตรง → link `auth_user_id`

- [ ] **Step 1: เพิ่ม auto-link ก่อน bootstrap**

ใน `getCurrentUserProfile()` — แทนบล็อก `if (!profile) { profile = await bootstrapFirstProfileIfEmpty(...) }` ด้วย:

```ts
  if (!profile) {
    profile = await linkInvitedProfile(authUser.id, authUser.email || null);
  }
  if (!profile) {
    profile = await bootstrapFirstProfileIfEmpty(authUser.id, authUser.email || null);
  }

  const roleKeys = profile ? await getUserRoles(String(profile.id)) : [];
  const primaryRole = resolvePrimaryRole(roleKeys);
```

และเปลี่ยน `roleLabel: "ผู้ใช้งานระบบ"` → `roleLabel: roleLabelTh(primaryRole)`

- [ ] **Step 2: เขียน `linkInvitedProfile`**

```ts
// เพิ่มใน current-user.ts
async function linkInvitedProfile(authUserId: string, email: string | null) {
  const adminClient = getSupabaseServerDataClient();
  if (!adminClient || !email) return null;

  const { data: invited } = await adminClient
    .from("profiles")
    .select("id, auth_user_id, organization_id, full_name, email, status")
    .ilike("email", email)
    .is("auth_user_id", null)
    .maybeSingle();

  if (!invited) return null;

  const { data: linked } = await adminClient
    .from("profiles")
    .update({ auth_user_id: authUserId, status: "active" })
    .eq("id", invited.id)
    .select("id, auth_user_id, organization_id, full_name, email")
    .single();

  return linked ?? null;
}
```

- [ ] **Step 3: เพิ่ม import**

บนสุด (จัด order ตาม eslint — internal group เรียง alphabetical):
```ts
import { roleLabelTh } from "@/lib/i18n/role-th";
import { resolvePrimaryRole } from "@/lib/auth/role-model";
import { getUserRoles } from "@/lib/auth/rbac";
```
> ⚠️ ระวัง circular: `rbac.ts` import `current-user.ts`. ถ้า typecheck/รันเจอ circular → ย้าย `getUserRoles` logic ที่ต้องใช้มาเป็น query ตรงใน `current-user.ts` แทน (select `user_role_assignments` + `project_members` join `roles`).

- [ ] **Step 4: verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS ทั้งหมด (30 tests เดิม + ใหม่)

- [ ] **Step 5: manual — dev เปิดเว็บได้**

Run: `npm run dev` → เปิด `http://localhost:3000/`
Expected: หน้าโหลด, sidebar footer แสดง role (dev = "ผู้ดูแลแพลตฟอร์ม")

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/auth/current-user.ts
git commit -m "feat(rbac): resolve real role label + auto-link invited profiles by email

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `<AccessDenied>` + `/no-access` page

**Files:**
- Create: `apps/web/components/auth/access-denied.tsx`
- Create: `apps/web/app/no-access/page.tsx`
- Modify: `apps/web/middleware.ts:4` (เพิ่ม `/no-access` ใน `PUBLIC_PREFIXES`)

**Interfaces:**
- Produces: `<AccessDenied title? reason? requiredRole?>` — panel + ปุ่มกลับหน้าแรก + ปุ่มออกจากระบบ

- [ ] **Step 1: `<AccessDenied>`**

```tsx
// apps/web/components/auth/access-denied.tsx
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

interface AccessDeniedProps {
  title?: string;
  reason?: string;
  requiredRole?: string;
}

export function AccessDenied({ title = "บัญชีนี้ยังไม่ได้รับสิทธิ์", reason, requiredRole }: AccessDeniedProps) {
  return (
    <section className="mx-auto grid min-h-[60vh] w-full max-w-lg content-center gap-4 px-4">
      <div className="enterprise-panel grid gap-4 p-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-panel bg-rose-50 text-rose-600">
          <ShieldX className="h-6 w-6" />
        </span>
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-description mx-auto mt-2">
            {reason || "กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าใช้งานส่วนนี้"}
            {requiredRole ? ` (ต้องมีบทบาท: ${requiredRole})` : ""}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-panel bg-operation px-5 text-sm font-semibold text-white transition hover:bg-operation-deep"
          >
            กลับหน้าแรก
          </Link>
          <LogoutButton />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: `/no-access` page**

```tsx
// apps/web/app/no-access/page.tsx
import { AccessDenied } from "@/components/auth/access-denied";

export default function NoAccessPage() {
  return (
    <AccessDenied
      title="ยังไม่ได้รับสิทธิ์เข้าใช้งาน"
      reason="บัญชีของคุณเข้าสู่ระบบสำเร็จ แต่ยังไม่ได้ถูกกำหนดบทบาทในระบบ กรุณาติดต่อผู้ดูแลเพื่อเพิ่มสิทธิ์"
    />
  );
}
```

- [ ] **Step 3: middleware — `/no-access` public**

`apps/web/middleware.ts:4` — เพิ่ม `"/no-access"` ใน `PUBLIC_PREFIXES` array (หลัง `/login`)

- [ ] **Step 4: verify**

Run: `npm run typecheck && npm run lint`
Run: `npm run dev` → เปิด `http://localhost:3000/no-access`
Expected: หน้าแสดง panel + 2 ปุ่ม, ไม่ redirect ไป login

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/auth/access-denied.tsx apps/web/app/no-access/ apps/web/middleware.ts
git commit -m "feat(auth): AccessDenied component + /no-access page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: `/auth/callback` — redirect by role

**Files:**
- Modify: `apps/web/app/auth/callback/route.ts` (rewrite)

**Interfaces:**
- Consumes: `getViewerAccess` จาก `@/lib/auth/access`, `resolveRedirectPath` จาก `@/lib/auth/role-model`
- Behavior: exchange code → `getViewerAccess()` → ถ้า `next` param เป็น path ที่ปลอดภัยและไม่ใช่ `/` ให้ไป `next`; ไม่งั้นไป `resolveRedirectPath(primaryRole)`

- [ ] **Step 1: rewrite route**

```ts
// apps/web/app/auth/callback/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { getSessionAwareAuthClient } from "@/lib/auth/auth-server";
import { getViewerAccess } from "@/lib/auth/access";
import { resolveRedirectPath } from "@/lib/auth/role-model";

function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw === "/" || raw === "/login") return null;
  return raw;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const supabase = await getSessionAwareAuthClient();

  if (code && supabase) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const explicitNext = safeNext(url.searchParams.get("next"));
  if (explicitNext) {
    return NextResponse.redirect(new URL(explicitNext, url.origin));
  }

  const { primaryRole } = await getViewerAccess();
  return NextResponse.redirect(new URL(resolveRedirectPath(primaryRole), url.origin));
}
```

- [ ] **Step 2: verify build**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 3: manual (ถ้ามี Supabase Auth เปิด) หรือ code-review**

ถ้าทดสอบจริงไม่ได้ (Auth provider ยังไม่เปิด) — verify ด้วย reading: code path ครบ, `safeNext` กัน open-redirect, dev fallback → `primaryRole = "super_admin"` → redirect `/`

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/auth/callback/route.ts
git commit -m "feat(auth): redirect to role-appropriate workspace after login

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: `<RoleBadge>` component

**Files:**
- Create: `apps/web/components/auth/role-badge.tsx`

**Interfaces:**
- Produces: `<RoleBadge roleKey primaryRole? />` — pill เล็กแสดง Thai role label; `super_admin` = สี pilot/ม่วง, อื่น ๆ = slate

- [ ] **Step 1: implement**

```tsx
// apps/web/components/auth/role-badge.tsx
import { roleLabelTh } from "@/lib/i18n/role-th";

export function RoleBadge({ roleKey }: { roleKey: string | null }) {
  const isPlatform = roleKey === "super_admin";
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        isPlatform ? "bg-pilot/15 text-pilot" : "bg-white/10 text-slate-200"
      }`}
    >
      {roleLabelTh(roleKey)}
    </span>
  );
}
```

- [ ] **Step 2: verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/auth/role-badge.tsx
git commit -m "feat(auth): RoleBadge component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: `app-nav.tsx` — consume filtered nav

**Files:**
- Modify: `apps/web/components/app-nav.tsx` (rewrite — รับ props แทน hardcode)

**Interfaces:**
- Consumes: `NavSection[]` (filtered แล้วจาก server) ผ่าน prop `sections`
- Produces: `<AppNav sections={NavSection[]} />` — client component; map `icon: string` → lucide component

- [ ] **Step 1: rewrite `app-nav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CarFront, ChevronRight, ClipboardList, FolderKanban, Gauge, MapPinned, Menu,
  PanelsTopLeft, ShieldAlert, UserRoundCheck, Users, X, type LucideIcon
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import type { NavSection } from "@/lib/auth/nav-model";

const ICONS: Record<string, LucideIcon> = {
  Gauge, MapPinned, ClipboardList, FolderKanban, CarFront, UserRoundCheck,
  PanelsTopLeft, Users, ShieldAlert
};

export function AppNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="grid gap-3">
      <button
        className="flex min-h-11 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm lg:hidden"
        onClick={() => setOpen((c) => !c)}
        type="button"
      >
        <span>เมนูระบบ</span>
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      <nav className={`${open ? "grid" : "hidden"} gap-5 lg:grid`} aria-label="เมนูหลัก">
        {sections.map((section) => (
          <section key={section.title} className="grid gap-2">
            <p className="px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 lg:text-slate-400">{section.title}</p>
            <div className="grid gap-1.5">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon] ?? Gauge;
                const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Tooltip key={item.href} content={item.help} side="right" className="w-full">
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`group flex w-full items-center gap-3 rounded-[18px] border px-3 py-3 transition duration-200 ${
                        active
                          ? "border-teal-300/60 bg-white text-ink shadow-[0_16px_34px_rgba(15,118,110,0.18)] lg:bg-white/95"
                          : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50 lg:bg-transparent lg:text-slate-300 lg:hover:border-white/10 lg:hover:bg-white/8 lg:hover:text-white"
                      }`}
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[14px] ${
                        active ? "bg-operation text-white" : "bg-slate-100 text-slate-500 group-hover:text-operation lg:bg-white/8 lg:text-slate-400 lg:group-hover:text-white"
                      }`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold leading-5">{item.label}</span>
                        <span className={`mt-0.5 block truncate text-[12px] leading-5 ${active ? "text-slate-600" : "text-slate-500 lg:group-hover:text-slate-300"}`}>
                          {item.description}
                        </span>
                      </span>
                      <ChevronRight className={`h-4 w-4 shrink-0 ${active ? "text-operation" : "text-slate-300 opacity-0 transition group-hover:opacity-100"}`} />
                    </Link>
                  </Tooltip>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: verify build (จะ error เพราะ app-shell ยังไม่ส่ง props — แก้ Task 12)**

Run: `npm run typecheck`
Expected: FAIL ที่ `app-shell.tsx` — `<AppNav />` missing prop `sections`. (จะแก้ Task 12 — ไม่ commit จนกว่า Task 12 เสร็จ)

- [ ] **Step 3: (ยังไม่ commit — รวมกับ Task 12)**

---

## Task 12: `app-shell.tsx` — wire access, drop AuthGate

**Files:**
- Modify: `apps/web/components/app-shell.tsx`
- Delete: `apps/web/components/auth/auth-gate.tsx`

**Interfaces:**
- Consumes: `getViewerAccess`, `NAV_SECTIONS`, `filterNav`
- Produces: server component ที่ resolve access + ส่ง `sections` + `primaryRole` ลง client parts

- [ ] **Step 1: rewrite `app-shell.tsx`**

```tsx
import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { AuthStatus } from "@/components/auth/auth-status";
import { RoleBadge } from "@/components/auth/role-badge";
import { BuildVersionBadge } from "@/components/layout/build-version-badge";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { getViewerAccess } from "@/lib/auth/access";
import { NAV_SECTIONS, filterNav } from "@/lib/auth/nav-model";

export async function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const { permissions, roleKeys, primaryRole } = await getViewerAccess();
  const sections = filterNav(NAV_SECTIONS, { permissions, roleKeys });

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="command-panel-dark hidden text-white lg:block">
          <div className="sticky top-0 flex h-screen flex-col overflow-y-auto border-r border-white/10 px-4 py-5">
            <Link href="/" className="group block rounded-[26px] border border-white/10 bg-white/[0.08] p-4 shadow-command transition hover:bg-white/[0.12]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold tracking-[0.32em] text-teal-200">TOMP</p>
                  <h1 className="mt-2.5 text-[20px] font-semibold leading-7 text-white">ศูนย์ปฏิบัติการขนส่ง</h1>
                  <p className="mt-2 text-[12px] leading-6 text-slate-300">
                    วางแผน มอบหมายงาน ติดตาม GPS และควบคุมการปฏิบัติการจากพื้นที่เดียว
                  </p>
                </div>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-teal-300 px-2.5 py-1 text-[10px] font-bold tracking-wide text-teal-950">LIVE</span>
              </div>
            </Link>

            <div className="mt-5 flex-1">
              <AppNav sections={sections} />
            </div>

            <div className="mt-5 grid gap-3 rounded-[22px] border border-white/10 bg-white/[0.07] p-4">
              <RoleBadge roleKey={primaryRole} />
              <EnvironmentBadge />
              <BuildVersionBadge />
              <AuthStatus />
              <p className="text-[11px] leading-5 text-slate-400">
                ใช้ตำแหน่งเพื่อควบคุมงานตามความยินยอมของคนขับเท่านั้น ไม่ใช่ระบบติดตามนอกเวลาปฏิบัติงาน
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/94 shadow-sm backdrop-blur lg:hidden">
            <div className="grid gap-3 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <Link href="/" className="min-w-0">
                  <p className="text-[11px] font-bold tracking-[0.28em] text-operation">TOMP</p>
                  <p className="truncate text-base font-semibold text-ink">ศูนย์ปฏิบัติการขนส่ง</p>
                </Link>
                <div className="grid justify-items-end gap-1">
                  <EnvironmentBadge />
                  <BuildVersionBadge compact />
                </div>
              </div>
              <AppNav sections={sections} />
            </div>
          </header>

          <WorkspaceShell>{children}</WorkspaceShell>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ลบ AuthGate**

Run: `rm apps/web/components/auth/auth-gate.tsx`
ตรวจว่าไม่มีที่อื่น import: `grep -rn "auth-gate\|AuthGate" apps/web` → ต้องว่าง

- [ ] **Step 3: verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS ทั้งหมด

- [ ] **Step 4: manual — nav ตาม role**

Run: `npm run dev`
- เปิด `/` (dev = super_admin) → เห็นทุก section รวม "ระบบ / Superadmin"
- (ถ้าตั้ง `TOMP_ALLOW_AUTH_FALLBACK` ปิด + ไม่มี session → middleware เด้ง `/login`)

- [ ] **Step 5: screenshot regression**

Run: `node scripts/live-test-smoke.mjs` (ยังต้องทำงานได้) + เปิด `/`, `/projects`, `/mission-control` เช็ค 0 overflow

- [ ] **Step 6: Commit (รวม Task 11 + 12)**

```bash
git add apps/web/components/app-nav.tsx apps/web/components/app-shell.tsx
git rm apps/web/components/auth/auth-gate.tsx
git commit -m "feat(rbac): permission-filtered nav + drop client AuthGate

app-shell resolves viewer access server-side and passes the filtered
nav sections + primary role into the shell. Removes the redundant
client AuthGate (middleware already gates every non-public route).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: `<PermissionGate>` + `<EmptyState>` + `<Breadcrumb>` (UX baseline)

**Files:**
- Create: `apps/web/components/auth/permission-gate.tsx`
- Create: `apps/web/components/ui/empty-state.tsx`
- Create: `apps/web/components/ui/breadcrumb.tsx`

**Interfaces:**
- `<PermissionGate anyPermission? anyRole? fallback?>` — server component; render children ถ้าผ่าน, ไม่งั้น `fallback` (default `<AccessDenied>`)
- `<EmptyState icon? title action?>` — onboarding empty state
- `<Breadcrumb items={{label, href?}[]}>` — trail

- [ ] **Step 1: `<PermissionGate>`**

```tsx
// apps/web/components/auth/permission-gate.tsx
import type { ReactNode } from "react";
import { AccessDenied } from "@/components/auth/access-denied";
import { getViewerAccess } from "@/lib/auth/access";

interface PermissionGateProps {
  children: ReactNode;
  anyPermission?: string[];
  anyRole?: string[];
  fallback?: ReactNode;
}

export async function PermissionGate({ children, anyPermission, anyRole, fallback }: PermissionGateProps) {
  const { permissions, roleKeys } = await getViewerAccess();
  const ok =
    permissions.includes("*") ||
    (anyPermission?.some((p) => permissions.includes(p)) ?? false) ||
    (anyRole?.some((r) => roleKeys.includes(r)) ?? false) ||
    (!anyPermission && !anyRole);

  if (ok) return <>{children}</>;
  return <>{fallback ?? <AccessDenied requiredRole={anyRole?.join(", ")} />}</>;
}
```

- [ ] **Step 2: `<EmptyState>`**

```tsx
// apps/web/components/ui/empty-state.tsx
import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="grid justify-items-center gap-3 rounded-panel border border-dashed border-border bg-canvas/50 px-6 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-panel bg-white text-ink-faint shadow-sm">
        {icon ?? <Inbox className="h-5 w-5" />}
      </span>
      <div>
        <p className="card-title">{title}</p>
        {description ? <p className="section-description mx-auto mt-1 max-w-sm">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
```

- [ ] **Step 3: `<Breadcrumb>`**

```tsx
// apps/web/components/ui/breadcrumb.tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-ink-faint">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1">
          {index > 0 ? <ChevronRight className="h-3 w-3 text-border" /> : null}
          {item.href ? (
            <Link href={item.href} className="font-medium hover:text-operation">{item.label}</Link>
          ) : (
            <span className="font-semibold text-ink-soft">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/auth/permission-gate.tsx apps/web/components/ui/empty-state.tsx apps/web/components/ui/breadcrumb.tsx
git commit -m "feat(ux): PermissionGate, EmptyState, Breadcrumb primitives

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 14: Gate existing admin/test routes with `<PermissionGate>` (interim)

> จนกว่า Phase 2 จะย้าย route จริง — ห่อหน้า admin/test ด้วย gate เพื่อไม่ให้ role อื่นเข้าถึง

**Files:**
- Modify: `apps/web/app/admin/page.tsx`, `apps/web/app/admin/*/page.tsx` (5 ไฟล์), `apps/web/app/live-test/page.tsx`, `apps/web/app/pilot-checklist/page.tsx`

**Interfaces:**
- Consumes: `<PermissionGate anyRole={["super_admin"]}>`

- [ ] **Step 1: ห่อแต่ละหน้า**

pattern (ทำกับทุกไฟล์ในลิสต์):
```tsx
import { PermissionGate } from "@/components/auth/permission-gate";
// ...
export default function XxxPage() {
  return (
    <PermissionGate anyRole={["super_admin"]}>
      {/* ...เนื้อหาเดิม... */}
    </PermissionGate>
  );
}
```
ถ้าหน้าเป็น `async` ให้คง `async` และห่อ return เหมือนกัน

- [ ] **Step 2: verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS

- [ ] **Step 3: manual**

Run: `npm run dev`
- dev (super_admin) → `/admin`, `/live-test` เข้าได้
- (verify negative ทำได้เต็มที่ Phase 3 เมื่อมี seeded users)

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/admin apps/web/app/live-test apps/web/app/pilot-checklist
git commit -m "feat(rbac): gate admin + dev-test routes to super_admin (interim)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 15: Phase 0-1 regression + doc update

**Files:**
- Modify: `docs/11-codex/922-production-rbac-ux-restructure-plan.md` (ทำ checkbox Phase 0-1)
- Create: `docs/11-codex/924-rbac-phase-0-1-done.md` (handoff สั้น)

- [ ] **Step 1: full verify**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: PASS ทั้งหมด (build สำคัญ — RSC + server-only imports)

- [ ] **Step 2: screenshot sweep**

Run: dev server + เปิด `/`, `/projects`, `/mission-control?projectId=<pilot>`, `/assignments`, `/no-access`, `/login`
Expected: 0 horizontal overflow, nav แสดงครบ (dev=super_admin), RoleBadge ใน footer

- [ ] **Step 3: เขียน handoff `924-rbac-phase-0-1-done.md`**

สรุป: อะไรทำแล้ว, migration ใหม่ (`0018`), helper ใหม่ (`role-model`, `nav-model`, `access`, `permissions.loadRolePermissions`), component ใหม่, ค้าง: Phase 2 (superadmin + ย้าย tools), วิธี test negative (ต้องมี seeded users — `scripts/seed-test-users.mjs` ยังไม่ทำ, เลื่อนไป Phase 3)

- [ ] **Step 4: Commit**

```bash
git add docs/11-codex/
git commit -m "docs: Phase 0-1 done — RBAC role resolution + permission-filtered nav

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-review notes

**Spec coverage (§ ของ 922):**
- §2.5 RBAC source of truth → Task 1, 5 ✓
- §2.4 role redirect → Task 2, 9 ✓
- §2.4b auto-link invited → Task 7 ✓
- §2.3 nav grouping + permission filter → Task 4, 11, 12 ✓
- §7.2 AccessDenied / EmptyState / Breadcrumb → Task 8, 13 ✓
- §7.7 RoleBadge, PermissionGate → Task 10, 13 ✓
- ลบ AuthGate → Task 12 ✓
- roleLabel จริง → Task 7 ✓
- gate admin/test (interim ก่อน Phase 2) → Task 14 ✓
- **ยกไป Phase ถัดไป:** `getScopedDataClient` + `lib/data/*` (Phase 3), `0019` RLS (Phase 3), `/superadmin/*` (Phase 2), `scripts/seed-test-users.mjs` + RLS tests (Phase 3), `<ProjectScopePill>` (Phase 3)

**Circular import risk (Task 7):** `current-user.ts` ↔ `rbac.ts` — ถ้าเจอ ให้ inline query ใน `current-user.ts` (ระบุใน Task 7 Step 3)

**dev fallback:** ทุก path เช็ค `isDevelopmentFallback` → `super_admin` + `["*"]` (Task 6) → dev เปิดเว็บได้ตลอด

**No placeholders:** ทุก step มี code จริง / คำสั่งจริง / expected result
