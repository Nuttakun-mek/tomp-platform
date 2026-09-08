# RBAC Restructure — Phase 2 Implementation Plan

> **For agentic workers:** implement task-by-task; each task ends green (`typecheck && lint && test`) and gets its own commit. Steps use `- [ ]`.

**Goal:** ยก dev/test tools ออกจาก nav หลักไปอยู่ใต้ `/superadmin` (gate ด้วย role `super_admin`), + หน้า `/superadmin/users` สำหรับเพิ่มผู้ใช้และกำหนดบทบาทโดยไม่ต้องยิง SQL

**Architecture:** route group `app/superadmin/` มี `layout.tsx` ที่ gate ทั้ง section + แถบ "INTERNAL" + sub-nav. เครื่องมือเดิม (live-test, smoke, data-quality, readiness, runbook, pilot-checklist) ย้าย page file เข้า `app/superadmin/dev-tools/*` (component/lib คงที่เดิม). `next.config` redirect path เก่า→ใหม่. `/superadmin/users` = list profiles + form pre-provision (สร้าง `profiles` status `invited` + `user_role_assignments`/`project_members`) ผ่าน service-role action ที่เช็ค `admin.manage_users`.

**Tech Stack:** Next.js 15 App Router, Supabase (service-role client สำหรับ user admin), vitest, Tailwind

## Global Constraints

- ต่อจาก branch `fix/pilot-stability-followup` commit `059f863`
- Thai copy ตาม `docs/05-ux/505-thai-copy-guideline.md`
- ทุก commit จบด้วย `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- verify: `npm run typecheck && npm run lint && npm test` เขียว; dev route 200
- **ห้ามแตะ** `lib/data/*`, RLS, `/driver*`
- dev fallback (`isDevelopmentFallback`) = `super_admin` → ต้องเข้า `/superadmin` ได้ใน dev
- `getViewerAccess()` (Phase 1) เป็นตัวเช็คสิทธิ์หลัก

---

## File Structure

| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `apps/web/app/superadmin/layout.tsx` | gate `super_admin` + INTERNAL banner + sub-nav | สร้าง |
| `apps/web/components/superadmin/superadmin-shell.tsx` | banner + sub-nav (client for active state) | สร้าง |
| `apps/web/app/superadmin/page.tsx` | landing (การ์ดลิงก์) | สร้าง |
| `apps/web/app/superadmin/dev-tools/page.tsx` | landing เครื่องมือพัฒนา | สร้าง |
| `apps/web/app/superadmin/dev-tools/live-test/page.tsx` | ← ย้ายจาก `app/live-test` | ย้าย |
| `apps/web/app/superadmin/dev-tools/smoke-test/page.tsx` | ← `app/admin/pilot-smoke-test` | ย้าย |
| `apps/web/app/superadmin/dev-tools/data-quality/page.tsx` | ← `app/admin/data-quality` | ย้าย |
| `apps/web/app/superadmin/dev-tools/readiness/page.tsx` | ← `app/admin/enterprise-readiness` | ย้าย |
| `apps/web/app/superadmin/dev-tools/runbook/page.tsx` | ← `app/admin/operations` | ย้าย |
| `apps/web/app/superadmin/dev-tools/pilot-checklist/page.tsx` | ← `app/pilot-checklist` | ย้าย |
| `apps/web/app/{live-test,pilot-checklist,admin}/` | ลบ (redirect ผ่าน next.config) | ลบ |
| `apps/web/next.config.ts` | + `redirects()` | แก้ |
| `apps/web/lib/superadmin/users.ts` | `listProfilesWithRoles()`, `provisionUser()` | สร้าง |
| `apps/web/lib/superadmin/users.test.ts` | unit test ของ input validation | สร้าง |
| `apps/web/app/actions/superadmin-users.ts` | `provisionUserAction` (เช็ค `admin.manage_users`) | สร้าง |
| `apps/web/app/superadmin/users/page.tsx` | list + form | สร้าง |
| `apps/web/components/superadmin/user-list.tsx` | ตารางผู้ใช้ | สร้าง |
| `apps/web/components/superadmin/invite-user-form.tsx` | ฟอร์มเพิ่มผู้ใช้ (client) | สร้าง |
| `apps/web/lib/auth/nav-model.ts` | (ไม่ต้องแก้ — `/superadmin` มีอยู่แล้ว) | — |

---

## Task 1: Superadmin layout + shell + landing

**Files:**
- Create: `apps/web/components/superadmin/superadmin-shell.tsx`
- Create: `apps/web/app/superadmin/layout.tsx`
- Create: `apps/web/app/superadmin/page.tsx`

**Interfaces:**
- Produces: `<SuperadminShell active>` — banner + tabs (ภาพรวม / ผู้ใช้ / เครื่องมือพัฒนา); `layout.tsx` gate ด้วย `getViewerAccess().roleKeys.includes("super_admin")`

- [ ] **Step 1: `superadmin-shell.tsx` (client — active tab)**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";

const TABS = [
  { href: "/superadmin", label: "ภาพรวม" },
  { href: "/superadmin/users", label: "ผู้ใช้และสิทธิ์" },
  { href: "/superadmin/dev-tools", label: "เครื่องมือพัฒนา" }
];

export function SuperadminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="grid gap-5" data-area="superadmin">
      <div className="flex items-center gap-3 rounded-panel border border-pilot/25 bg-pilot/10 px-4 py-2.5 text-sm font-semibold text-pilot">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        พื้นที่ภายในสำหรับทีมแพลตฟอร์มเท่านั้น
      </div>
      <nav className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => {
          const active = tab.href === "/superadmin" ? pathname === "/superadmin" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-panel px-3.5 py-1.5 text-[13px] font-semibold transition ${
                active ? "bg-command text-white" : "border border-border bg-white text-ink-soft hover:border-operation/40"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: `layout.tsx` (gate)**

```tsx
import { AccessDenied } from "@/components/auth/access-denied";
import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { getViewerAccess } from "@/lib/auth/access";

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const { roleKeys } = await getViewerAccess();
  if (!roleKeys.includes("super_admin")) {
    return <AccessDenied requiredRole="ผู้ดูแลแพลตฟอร์ม" reason="ส่วนนี้สำหรับทีมแพลตฟอร์มเท่านั้น" />;
  }
  return <SuperadminShell>{children}</SuperadminShell>;
}
```

- [ ] **Step 3: `page.tsx` (landing)**

```tsx
import Link from "next/link";
import { Users, Wrench } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export default function SuperadminPage() {
  return (
    <>
      <PageHeader
        eyebrow="ทีมแพลตฟอร์ม"
        title="ศูนย์ควบคุมแพลตฟอร์ม"
        description="จัดการผู้ใช้และบทบาท และเปิดเครื่องมือพัฒนาสำหรับตรวจแต่ละฟังก์ชันของระบบ"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Link className="smart-card p-5" href="/superadmin/users">
          <span className="grid h-11 w-11 place-items-center rounded-panel bg-command text-white">
            <Users className="h-5 w-5" />
          </span>
          <h2 className="card-title mt-4">ผู้ใช้และสิทธิ์</h2>
          <p className="section-description mt-1.5">เพิ่มผู้ใช้ กำหนดบทบาทระดับองค์กรและโครงการ</p>
        </Link>
        <Link className="smart-card p-5" href="/superadmin/dev-tools">
          <span className="grid h-11 w-11 place-items-center rounded-panel bg-command text-white">
            <Wrench className="h-5 w-5" />
          </span>
          <h2 className="card-title mt-4">เครื่องมือพัฒนา</h2>
          <p className="section-description mt-1.5">ทดสอบ QR/GPS, ตรวจ infrastructure, คุณภาพข้อมูล และความพร้อมระบบ</p>
        </Link>
      </div>
    </>
  );
}
```

- [ ] **Step 4: verify**

Run: `npm run typecheck && npm run lint`
Run: `npm run dev` → `http://localhost:3000/superadmin` → เห็น banner + tabs + 2 การ์ด (dev = super_admin)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/superadmin/layout.tsx apps/web/app/superadmin/page.tsx apps/web/components/superadmin/
git commit -m "feat(superadmin): gated layout + landing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Move dev-tools pages + dev-tools landing

**Files:**
- Create: `apps/web/app/superadmin/dev-tools/page.tsx`
- Move (git mv content): 6 page files (ดู File Structure)
- Delete: `apps/web/app/live-test/`, `apps/web/app/pilot-checklist/`, `apps/web/app/admin/`

**Interfaces:** เพจที่ย้ายมา — **ลบ `<PermissionGate>` wrapper** (layout gate แล้ว), คง `<PageHeader>` + panel เดิม, แก้ import path ที่เป็น relative ถ้ามี

- [ ] **Step 1: `dev-tools/page.tsx` (landing)**

```tsx
import Link from "next/link";
import { Activity, ClipboardList, DatabaseZap, Gauge, ListChecks, ServerCog } from "lucide-react";
import { PageHeader } from "@/components/page-header";

const TOOLS = [
  { href: "/superadmin/dev-tools/live-test", label: "ทดสอบ QR + GPS", detail: "สร้าง Assignment จริง เปิด QR คนขับ แชร์ GPS จบในหน้าเดียว", icon: Activity },
  { href: "/superadmin/dev-tools/smoke-test", label: "ตรวจ infrastructure", detail: "ตรวจตาราง Supabase และ Postgres readiness แบบละเอียด", icon: ServerCog },
  { href: "/superadmin/dev-tools/data-quality", label: "คุณภาพข้อมูล", detail: "หาชื่อไทยเพี้ยน Assignment ไม่ครบ QR ที่ยังใช้ไม่ได้", icon: DatabaseZap },
  { href: "/superadmin/dev-tools/readiness", label: "ความพร้อม 12 แกน", detail: "สิ่งที่พร้อม สิ่งที่ต้อง harden ก่อน production", icon: Gauge },
  { href: "/superadmin/dev-tools/runbook", label: "Runbook ดูแลระบบ", detail: "ขั้นตอนตรวจสุขภาพระบบและรับมือเหตุผิดปกติ", icon: ListChecks },
  { href: "/superadmin/dev-tools/pilot-checklist", label: "Pilot checklist", detail: "ลำดับทดสอบ end-to-end ทีละบทบาท", icon: ClipboardList }
];

export default function DevToolsPage() {
  return (
    <>
      <PageHeader
        eyebrow="เครื่องมือพัฒนา"
        title="เครื่องมือตรวจและทดสอบระบบ"
        description="ใช้พัฒนาและตรวจแต่ละฟังก์ชันของระบบ แยกจากงานจริงของผู้ใช้"
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.href} className="smart-card p-5" href={tool.href}>
              <span className="grid h-10 w-10 place-items-center rounded-panel bg-command text-white">
                <Icon className="h-4 w-4" />
              </span>
              <h2 className="card-title mt-3.5">{tool.label}</h2>
              <p className="section-description mt-1.5">{tool.detail}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
```

- [ ] **Step 2: ย้าย live-test**

สร้าง `apps/web/app/superadmin/dev-tools/live-test/page.tsx`:
```tsx
import { LiveGpsTestPanel } from "@/components/live-test/live-gps-test-panel";
import { PageHeader } from "@/components/page-header";

export default function LiveTestPage() {
  return (
    <>
      <PageHeader
        eyebrow="ทดสอบระบบจบขั้นตอน"
        title="ทดสอบ QR คนขับและ GPS สด"
        description="ตรวจระบบ สร้าง Assignment จริง เปิด QR คนขับ แชร์ GPS และดูผลในศูนย์ควบคุม"
      />
      <LiveGpsTestPanel />
    </>
  );
}
```
แล้ว `rm -r apps/web/app/live-test`

- [ ] **Step 3: ย้าย smoke-test**

`apps/web/app/superadmin/dev-tools/smoke-test/page.tsx` — copy เนื้อจาก `app/admin/pilot-smoke-test/page.tsx` (ลบ `<PermissionGate>`, เปลี่ยนลิงก์ `/live-test` → `/superadmin/dev-tools/live-test`)

- [ ] **Step 4: ย้าย data-quality**

`apps/web/app/superadmin/dev-tools/data-quality/page.tsx` — copy จาก `app/admin/data-quality/page.tsx` (ลบ `<PermissionGate>`)

- [ ] **Step 5: ย้าย readiness**

`apps/web/app/superadmin/dev-tools/readiness/page.tsx` — copy จาก `app/admin/enterprise-readiness/page.tsx` (ลบ `<PermissionGate>`)

- [ ] **Step 6: ย้าย runbook**

`apps/web/app/superadmin/dev-tools/runbook/page.tsx` — copy จาก `app/admin/operations/page.tsx` (ลบ `<PermissionGate>`)

- [ ] **Step 7: ย้าย pilot-checklist**

`apps/web/app/superadmin/dev-tools/pilot-checklist/page.tsx` — copy จาก `app/pilot-checklist/page.tsx` (ลบ `<PermissionGate>`; ลิงก์ `/live-test` ใน steps → `/superadmin/dev-tools/live-test`, `/pilot-checklist` → `/superadmin/dev-tools/pilot-checklist`)

- [ ] **Step 8: ลบ dir เก่า**

```bash
rm -r apps/web/app/admin apps/web/app/pilot-checklist
```
grep เช็ค: `grep -rn '"/admin\|"/live-test\|"/pilot-checklist' apps/web --include=*.tsx` → แก้ทุก internal link ให้ชี้ path ใหม่ (มี: sidebar เดิม? — nav-model ไม่มี /admin แล้ว; เช็ค `today-operation-board`, `quick-action-panel`, `dispatch-board`, `assignments/page` ที่ลิงก์ `/live-test`)

- [ ] **Step 9: verify**

Run: `npm run typecheck && npm run lint && npm test`
Run: dev → `/superadmin/dev-tools`, `/superadmin/dev-tools/live-test`, `/superadmin/dev-tools/data-quality` = 200

- [ ] **Step 10: Commit**

```bash
git add apps/web/app/superadmin apps/web/app
git commit -m "feat(superadmin): relocate dev/test tools under /superadmin/dev-tools

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: next.config redirects for old paths

**Files:**
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: เพิ่ม `redirects()`**

```ts
const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["172.20.10.3", "localhost", "127.0.0.1"],
  async redirects() {
    return [
      { source: "/admin", destination: "/superadmin", permanent: false },
      { source: "/admin/pilot-smoke-test", destination: "/superadmin/dev-tools/smoke-test", permanent: false },
      { source: "/admin/data-quality", destination: "/superadmin/dev-tools/data-quality", permanent: false },
      { source: "/admin/enterprise-readiness", destination: "/superadmin/dev-tools/readiness", permanent: false },
      { source: "/admin/operations", destination: "/superadmin/dev-tools/runbook", permanent: false },
      { source: "/live-test", destination: "/superadmin/dev-tools/live-test", permanent: false },
      { source: "/pilot-checklist", destination: "/superadmin/dev-tools/pilot-checklist", permanent: false }
    ];
  }
};
```

- [ ] **Step 2: verify**

Run: `npm run build` (redirects ต้อง compile) — **หยุด dev server ก่อน** (`taskkill` port 3000) เพื่อไม่ให้ `.next` ชนกัน
Run: dev ใหม่ → `curl -sI localhost:3000/live-test` → `307` → `location: /superadmin/dev-tools/live-test`

- [ ] **Step 3: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "feat(superadmin): redirect legacy admin/test paths to /superadmin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `lib/superadmin/users.ts` — provision logic

**Files:**
- Create: `apps/web/lib/superadmin/users.ts`
- Create: `apps/web/lib/superadmin/users.test.ts`

**Interfaces:**
- Produces:
  - `interface ProvisionUserInput { email: string; fullName: string; organizationId: string; globalRoleKey?: string; projectId?: string; projectRoleKey?: string }`
  - `validateProvisionInput(input: unknown): { ok: true; value: ProvisionUserInput } | { ok: false; error: string }` (pure)
  - `listProfilesWithRoles(): Promise<ProfileRow[]>` (IO)
  - `provisionUser(input: ProvisionUserInput): Promise<{ ok: true; profileId: string } | { ok: false; error: string }>` (IO)

- [ ] **Step 1: failing test (validation only — pure)**

```ts
// apps/web/lib/superadmin/users.test.ts
import { describe, expect, it } from "vitest";
import { validateProvisionInput } from "./users";

describe("validateProvisionInput", () => {
  it("accepts a minimal valid input", () => {
    const r = validateProvisionInput({
      email: "a@b.com",
      fullName: "สมชาย",
      organizationId: "00000000-0000-4000-8000-000000000001",
      globalRoleKey: "dispatcher"
    });
    expect(r.ok).toBe(true);
  });
  it("rejects bad email", () => {
    const r = validateProvisionInput({ email: "nope", fullName: "x", organizationId: "x" });
    expect(r).toEqual({ ok: false, error: "อีเมลไม่ถูกต้อง" });
  });
  it("rejects when no role is given", () => {
    const r = validateProvisionInput({ email: "a@b.com", fullName: "x", organizationId: "o" });
    expect(r).toEqual({ ok: false, error: "ต้องกำหนดบทบาทอย่างน้อย 1 อย่าง" });
  });
  it("rejects project role without projectId", () => {
    const r = validateProvisionInput({ email: "a@b.com", fullName: "x", organizationId: "o", projectRoleKey: "planner" });
    expect(r).toEqual({ ok: false, error: "เลือกโครงการก่อนกำหนดบทบาทโครงการ" });
  });
});
```

- [ ] **Step 2: run — verify fail**

Run: `npm test -w @tomp/web -- superadmin/users`
Expected: FAIL — module not found

- [ ] **Step 3: implement**

```ts
// apps/web/lib/superadmin/users.ts
import "server-only";

import { randomUUID } from "crypto";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

export interface ProvisionUserInput {
  email: string;
  fullName: string;
  organizationId: string;
  globalRoleKey?: string;
  projectId?: string;
  projectRoleKey?: string;
}

type ValidationResult = { ok: true; value: ProvisionUserInput } | { ok: false; error: string };

export function validateProvisionInput(raw: unknown): ValidationResult {
  const input = (raw ?? {}) as Record<string, unknown>;
  const email = String(input.email ?? "").trim().toLowerCase();
  const fullName = String(input.fullName ?? "").trim();
  const organizationId = String(input.organizationId ?? "").trim();
  const globalRoleKey = input.globalRoleKey ? String(input.globalRoleKey) : undefined;
  const projectId = input.projectId ? String(input.projectId) : undefined;
  const projectRoleKey = input.projectRoleKey ? String(input.projectRoleKey) : undefined;

  if (!email.includes("@") || email.length < 5) return { ok: false, error: "อีเมลไม่ถูกต้อง" };
  if (!fullName) return { ok: false, error: "กรุณากรอกชื่อผู้ใช้" };
  if (!organizationId) return { ok: false, error: "กรุณาเลือกองค์กร" };
  if (!globalRoleKey && !projectRoleKey) return { ok: false, error: "ต้องกำหนดบทบาทอย่างน้อย 1 อย่าง" };
  if (projectRoleKey && !projectId) return { ok: false, error: "เลือกโครงการก่อนกำหนดบทบาทโครงการ" };

  return { ok: true, value: { email, fullName, organizationId, globalRoleKey, projectId, projectRoleKey } };
}

export interface ProfileRow {
  id: string;
  fullName: string;
  email: string | null;
  status: string;
  organizationId: string | null;
  roleKeys: string[];
}

export async function listProfilesWithRoles(): Promise<ProfileRow[]> {
  const client = getSupabaseServerDataClient();
  if (!client) return [];

  const { data: profiles } = await client
    .from("profiles")
    .select("id, full_name, email, status, organization_id")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (profiles || []) as Array<Record<string, unknown>>;
  if (!rows.length) return [];

  const ids = rows.map((r) => String(r.id));
  const { data: assignments } = await client
    .from("user_role_assignments")
    .select("profile_id, roles(role_key)")
    .in("profile_id", ids)
    .eq("status", "active");
  const { data: members } = await client
    .from("project_members")
    .select("profile_id, roles(role_key)")
    .in("profile_id", ids)
    .eq("status", "active");

  const byProfile = new Map<string, Set<string>>();
  for (const row of [...(assignments || []), ...(members || [])] as Array<Record<string, unknown>>) {
    const pid = String(row.profile_id);
    const roles = row.roles as { role_key?: string } | { role_key?: string }[] | null;
    const key = Array.isArray(roles) ? roles[0]?.role_key : roles?.role_key;
    if (!key) continue;
    if (!byProfile.has(pid)) byProfile.set(pid, new Set());
    byProfile.get(pid)!.add(key);
  }

  return rows.map((r) => ({
    id: String(r.id),
    fullName: typeof r.full_name === "string" ? r.full_name : "",
    email: typeof r.email === "string" ? r.email : null,
    status: typeof r.status === "string" ? r.status : "unknown",
    organizationId: typeof r.organization_id === "string" ? r.organization_id : null,
    roleKeys: [...(byProfile.get(String(r.id)) ?? [])]
  }));
}

export async function provisionUser(
  input: ProvisionUserInput
): Promise<{ ok: true; profileId: string } | { ok: false; error: string }> {
  const client = getSupabaseServerDataClient();
  if (!client) return { ok: false, error: "ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล" };

  const { data: existing } = await client.from("profiles").select("id").ilike("email", input.email).maybeSingle();
  if (existing) return { ok: false, error: "อีเมลนี้มีผู้ใช้อยู่แล้ว" };

  const roleKeys = [input.globalRoleKey, input.projectRoleKey].filter(Boolean) as string[];
  const { data: roles } = await client.from("roles").select("id, role_key").in("role_key", roleKeys);
  const roleIdByKey = new Map((roles || []).map((r) => [String((r as Record<string, unknown>).role_key), String((r as Record<string, unknown>).id)]));
  for (const key of roleKeys) {
    if (!roleIdByKey.has(key)) return { ok: false, error: `ไม่พบบทบาท ${key}` };
  }

  const profileId = randomUUID();
  const { error: profileError } = await client.from("profiles").insert({
    id: profileId,
    auth_user_id: null,
    organization_id: input.organizationId,
    full_name: input.fullName,
    email: input.email,
    status: "invited",
    metadata: { source: "superadmin_provision" }
  });
  if (profileError) return { ok: false, error: `สร้างผู้ใช้ไม่สำเร็จ: ${profileError.message}` };

  if (input.globalRoleKey) {
    await client.from("user_role_assignments").insert({
      profile_id: profileId,
      organization_id: input.organizationId,
      role_id: roleIdByKey.get(input.globalRoleKey),
      status: "active",
      metadata: { source: "superadmin_provision" }
    });
  }
  if (input.projectRoleKey && input.projectId) {
    await client.from("project_members").insert({
      project_id: input.projectId,
      profile_id: profileId,
      role_id: roleIdByKey.get(input.projectRoleKey),
      status: "active",
      metadata: { source: "superadmin_provision" }
    });
  }

  return { ok: true, profileId };
}
```

- [ ] **Step 4: run — verify pass**

Run: `npm test -w @tomp/web -- superadmin/users`
Expected: PASS (4)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/superadmin/
git commit -m "feat(superadmin): user provisioning logic (validate + list + provision)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `provisionUserAction` server action

**Files:**
- Create: `apps/web/app/actions/superadmin-users.ts`

**Interfaces:**
- Consumes: `requirePermission` จาก `@/lib/auth/rbac`, `validateProvisionInput` + `provisionUser` จาก `@/lib/superadmin/users`
- Produces: `provisionUserAction(input: unknown): Promise<ActionResult>`

- [ ] **Step 1: implement**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { requirePermission } from "@/lib/auth/rbac";
import { provisionUser, validateProvisionInput } from "@/lib/superadmin/users";

export async function provisionUserAction(input: unknown): Promise<ActionResult> {
  const permission = await requirePermission("admin.manage_users");
  if (!permission.allowed) {
    return actionFailure(permission.reason || "ไม่มีสิทธิ์จัดการผู้ใช้");
  }

  const validated = validateProvisionInput(input);
  if (!validated.ok) return actionFailure(validated.error);

  const result = await provisionUser(validated.value);
  if (!result.ok) return actionFailure(result.error);

  revalidatePath("/superadmin/users");
  return actionSuccess({ profileId: result.profileId });
}
```

- [ ] **Step 2: verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/actions/superadmin-users.ts
git commit -m "feat(superadmin): provisionUserAction (admin.manage_users gated)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `/superadmin/users` — list + form

**Files:**
- Create: `apps/web/app/superadmin/users/page.tsx`
- Create: `apps/web/components/superadmin/user-list.tsx`
- Create: `apps/web/components/superadmin/invite-user-form.tsx`

**Interfaces:**
- `page.tsx` (server) — `listProfilesWithRoles()` + `getProjects()` + roles list; render form + list
- `<InviteUserForm organizations projects roles>` (client) — form → `provisionUserAction`
- `<UserList rows>` — ตาราง

- [ ] **Step 1: `invite-user-form.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { provisionUserAction } from "@/app/actions/superadmin-users";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { roleLabelTh } from "@/lib/i18n/role-th";

interface Option {
  id: string;
  label: string;
}

const GLOBAL_ROLES = ["organization_admin", "operation_manager", "project_manager", "planner", "dispatcher", "coordinator", "organizer", "customer_viewer", "vendor"];
const PROJECT_ROLES = ["project_manager", "operation_manager", "planner", "dispatcher", "coordinator", "organizer"];

export function InviteUserForm({ organizations, projects }: { organizations: Option[]; projects: Option[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "danger">("danger");
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await provisionUserAction({
        email: formData.get("email"),
        fullName: formData.get("fullName"),
        organizationId: formData.get("organizationId"),
        globalRoleKey: formData.get("globalRoleKey") || undefined,
        projectId: formData.get("projectId") || undefined,
        projectRoleKey: formData.get("projectRoleKey") || undefined
      });
      if (result.success) {
        setTone("success");
        setMessage("เพิ่มผู้ใช้แล้ว — ให้ผู้ใช้เข้าสู่ระบบด้วยอีเมลนี้เพื่อเปิดใช้งานบัญชี");
      } else {
        setTone("danger");
        setMessage(result.error || "เพิ่มผู้ใช้ไม่สำเร็จ");
      }
    });
  }

  return (
    <form action={submit} className="enterprise-panel grid content-start gap-4 p-5">
      <div>
        <p className="section-label">เพิ่มผู้ใช้</p>
        <h2 className="section-title mt-1">เตรียมบัญชีและกำหนดบทบาท</h2>
        <p className="section-description mt-1">ระบบจะสร้าง profile ไว้ล่วงหน้า ผู้ใช้เข้าสู่ระบบด้วยอีเมลเดียวกันแล้วบัญชีจะผูกอัตโนมัติ</p>
      </div>
      <label className="field-label">
        อีเมล
        <input className="field-input" name="email" type="email" required placeholder="name@company.com" />
      </label>
      <label className="field-label">
        ชื่อผู้ใช้
        <input className="field-input" name="fullName" required placeholder="ชื่อ-นามสกุล" />
      </label>
      <label className="field-label">
        องค์กร
        <select className="field-input" name="organizationId" required>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="field-label">
        บทบาทระดับองค์กร (ไม่บังคับ)
        <select className="field-input" name="globalRoleKey" defaultValue="">
          <option value="">— ไม่กำหนด —</option>
          {GLOBAL_ROLES.map((r) => (
            <option key={r} value={r}>{roleLabelTh(r)}</option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          โครงการ (ไม่บังคับ)
          <select className="field-input" name="projectId" defaultValue="">
            <option value="">— ไม่กำหนด —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          บทบาทในโครงการ
          <select className="field-input" name="projectRoleKey" defaultValue="">
            <option value="">— ไม่กำหนด —</option>
            {PROJECT_ROLES.map((r) => (
              <option key={r} value={r}>{roleLabelTh(r)}</option>
            ))}
          </select>
        </label>
      </div>
      <ActionFeedback message={message} tone={tone} />
      <button
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-panel bg-operation px-5 text-sm font-semibold text-white transition hover:bg-operation-deep disabled:bg-slate-300"
        disabled={isPending}
        type="submit"
      >
        <UserPlus className="h-4 w-4" />
        {isPending ? "กำลังเพิ่ม..." : "เพิ่มผู้ใช้"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: `user-list.tsx`**

```tsx
import { roleLabelTh } from "@/lib/i18n/role-th";
import type { ProfileRow } from "@/lib/superadmin/users";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_TH: Record<string, string> = {
  active: "ใช้งาน",
  invited: "รอเข้าสู่ระบบ",
  inactive: "ปิดใช้งาน"
};

export function UserList({ rows }: { rows: ProfileRow[] }) {
  if (!rows.length) {
    return <EmptyState title="ยังไม่มีผู้ใช้" description="เพิ่มผู้ใช้คนแรกจากฟอร์มด้านซ้าย" />;
  }
  return (
    <div className="enterprise-panel overflow-hidden">
      <div className="grid gap-px bg-border">
        {rows.map((row) => (
          <div key={row.id} className="grid gap-1 bg-white p-4 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{row.fullName || "ยังไม่ระบุชื่อ"}</p>
              <p className="truncate text-xs text-ink-faint">{row.email || "ยังไม่ระบุอีเมล"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-canvas px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
                {STATUS_TH[row.status] ?? row.status}
              </span>
              {row.roleKeys.length ? (
                row.roleKeys.map((key) => (
                  <span key={key} className="rounded-full bg-operation-soft px-2.5 py-1 text-[11px] font-semibold text-operation">
                    {roleLabelTh(key)}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">ยังไม่มีบทบาท</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `page.tsx`**

```tsx
import { PageHeader } from "@/components/page-header";
import { InviteUserForm } from "@/components/superadmin/invite-user-form";
import { UserList } from "@/components/superadmin/user-list";
import { getProjects } from "@/lib/data/projects";
import { listProfilesWithRoles } from "@/lib/superadmin/users";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

export default async function SuperadminUsersPage() {
  const [rows, projects] = await Promise.all([listProfilesWithRoles(), getProjects()]);
  const client = getSupabaseServerDataClient();
  const { data: orgs } = client
    ? await client.from("organizations").select("id, name").order("name")
    : { data: [] as Array<{ id: string; name: string }> };

  const organizations = (orgs || []).map((o) => ({ id: String(o.id), label: String(o.name) }));
  const projectOptions = projects.map((p) => ({ id: p.id, label: `${p.projectCode} · ${p.projectName}` }));

  return (
    <>
      <PageHeader
        eyebrow="ทีมแพลตฟอร์ม"
        title="ผู้ใช้และสิทธิ์"
        description="เพิ่มผู้ใช้ กำหนดบทบาทระดับองค์กรและโครงการ ผู้ใช้จะเข้าสู่ระบบด้วยอีเมลเดียวกันเพื่อเปิดใช้บัญชี"
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] xl:items-start">
        <InviteUserForm organizations={organizations} projects={projectOptions} />
        <UserList rows={rows} />
      </div>
    </>
  );
}
```

- [ ] **Step 4: verify**

Run: `npm run typecheck && npm run lint && npm test`
Run: dev → `/superadmin/users` = 200; กรอกฟอร์มด้วย email ทดสอบ → เห็นในตาราง status "รอเข้าสู่ระบบ"

- [ ] **Step 5: cleanup test data**

ลบ profile ทดสอบที่สร้าง: `docker exec supabase_db_tomp-platform psql -U postgres -d postgres -c "delete from profiles where metadata->>'source' = 'superadmin_provision'"` (local) — cloud ไม่ต้องแตะถ้าไม่ได้ทดสอบบน cloud

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/superadmin/users apps/web/components/superadmin/
git commit -m "feat(superadmin): /superadmin/users — list + provision form

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Phase 2 regression + doc

**Files:**
- Modify: `docs/11-codex/922-production-rbac-ux-restructure-plan.md` (Phase 2 ✅)
- Create: `docs/11-codex/926-rbac-phase-2-done.md`

- [ ] **Step 1: full verify (dev หยุดก่อน build)**

```bash
taskkill //F //PID $(netstat -ano | grep ":3000 .*LISTENING" | awk '{print $5}' | head -1) 2>/dev/null
rm -rf apps/web/.next
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Step 2: route sweep**

dev ใหม่ → `/superadmin`, `/superadmin/users`, `/superadmin/dev-tools`, `/superadmin/dev-tools/live-test` = 200; `curl -sI /live-test` = 307 → new path; 0 horizontal overflow

- [ ] **Step 3: handoff `926-rbac-phase-2-done.md`**

สรุป: superadmin section + layout gate, dev-tools ย้ายครบ 6 + redirect, `/superadmin/users` provision flow. ค้าง: Phase 3 (RLS data scoping — งานใหญ่สุด), seeded users จะทำใน Phase 3

- [ ] **Step 4: Commit**

```bash
git add docs/11-codex/
git commit -m "docs: Phase 2 done — superadmin section + relocated dev tools + user provisioning

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-review

- §2.8 superadmin area (users, dev-tools) → Task 1, 2, 6 ✓
- ย้าย test tools + redirect → Task 2, 3 ✓
- §2.4b invite (pre-provision) → Task 4, 5, 6 ✓ (auto-link ตอน login ทำแล้ว Phase 1)
- role gate ด้วย `super_admin` → Task 1 (layout) ✓
- **ยกไป Phase 3:** `/superadmin/roles` matrix editor, `/superadmin/organizations`, `/superadmin/projects`, `/superadmin/audit` (§2.8 depth — Phase 5), RLS, seeded users
- **No placeholders:** ทุก step มี code จริง
- **Type consistency:** `ProfileRow`, `ProvisionUserInput`, `validateProvisionInput` ใช้ชื่อตรงกันทุก task
