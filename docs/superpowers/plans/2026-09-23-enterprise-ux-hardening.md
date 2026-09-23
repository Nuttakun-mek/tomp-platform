# Enterprise UX Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close a live global-permission escalation bug, give every account a real way to manage their own password, consolidate the two divergent account-creation surfaces into one, add loading-state coverage across the app, make the landing page skip itself when it has nothing to offer, and audit/fix UI consistency on the account-management surfaces — the six items from a 2026-09-22 enterprise-readiness audit (docs/11-codex, not yet numbered) the user approved except item 7 (bilingual rollout, explicitly excluded).

**Architecture:** Six independent-ish fixes against the existing Next.js 15 App Router + Supabase codebase. Task 1 (security fix) and Task 3 (account-creation consolidation) are related — Task 3 depends on Task 1 landing first, since the new "global project manager" grant path Task 3 introduces is exactly what makes Task 1's fix non-regressive (closing the accidental `project.create` leak would otherwise remove the *only* way, however accidental, to create such an account today). Tasks 2, 4, 5, 6 are independent of each other and of 1/3.

**Tech Stack:** Next.js 15 App Router (`apps/web`), Supabase Postgres, Zod, Vitest.

## Global Constraints

- No DB credentials in this worktree (prod-only Supabase, no staging) — Task 3's migration is written and mirrored to `supabase/migrations/`, never applied. Everything else (TypeScript/React/tests) runs for real.
- `git fetch --all` and confirm `git log HEAD..origin/main --oneline` is empty before every commit — multiple tracks push to this repo's `main` (confirmed again during this plan's own setup: 11 new commits from the mobile/UX track landed between this plan's authoring and the prior session).
- `apps/mobile-driver/**` is out of scope for every task in this plan.
- Preserve the Thai copy already live in `(app)/page.tsx` and `projects/page.tsx` (landed in commit `5244c1a`, "ศูนย์ปฏิบัติการขนส่ง" / system descriptions / "สร้างโครงการแรกเพื่อเริ่มจัดการงานปฏิบัติการ") — this plan's edits to those two files must build on the current content, not revert it.
- Every new/changed permission check must have a regression test proving both the allow and the deny path — this plan's whole reason for existing is a permission bug that had no test.
- Run `rm -rf apps/web/.next` before `npm run typecheck` whenever a route file was added/moved/deleted (stale generated route types cause phantom `tsc` errors — hit twice already in this repo's history).

---

## Task 1: Close the `project.create` global-permission leak

**Files:**
- Modify: `apps/web/lib/auth/rbac.ts:7-20` (`requirePermission`'s global-permission branch), `apps/web/lib/auth/rbac.ts:112-117` (`canCreateProject`)
- Modify: `apps/web/app/(app)/projects/page.tsx` (`canCreate`)
- Test: `apps/web/lib/auth/rbac.test.ts` (new file)

**Interfaces:**
- Produces: `requirePermission(permissionKey)` and `requirePermission(projectId, permissionKey)` — when `permissionKey` is in `GLOBAL_PERMISSIONS`, the allow decision now comes from `getGlobalRoleKeys(profileId)` only (rows in `user_role_assignments` with `project_id is null`) — never from `getUserRoles(profileId)`, which unions in every `project_members` role the profile holds anywhere.
- Produces: `canCreateProject()` uses the same `getGlobalRoleKeys`-only check.
- Consumed by: `apps/web/app/actions/projects.ts:29`'s `createProjectAction` (already calls `requirePermission("project.create")` — gets the fix for free, no change needed there), and `projects/page.tsx`'s `canCreate` (Step 4 below).

**The bug, precisely:** `requirePermission`'s global-permission branch (`rbac.ts:14-19`) calls `getUserRoles(profile.id)` with no `projectId` argument. `getUserRoles(profileId, projectId?)` (`rbac.ts:96-102`) is defined as `scoped = projectId ? memberships.filter(...) : memberships` — when `projectId` is `undefined`, `scoped` is *every* project membership the profile holds, unfiltered. Those role keys get unioned with the real global roles before the permission check runs. `ROLE_PERMISSIONS.project_manager` includes `"project.create"` (a `GLOBAL_PERMISSIONS`-listed key). Net effect: a profile granted `project_manager` on a single project via `project_members` — the normal, intended way to add a project manager to one project — can create brand-new, unrelated platform-wide projects, a capability that was never supposed to follow from a project-scoped grant.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/lib/auth/rbac.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const PROFILE_ID = "profile-1";

let globalRoleKeys: string[] = [];
let projectMemberships: Array<{ projectId: string; roleKey: string }> = [];

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUserProfile: vi.fn(async () => ({ id: PROFILE_ID, isDevelopmentFallback: false })),
  getProjectMembership: vi.fn(async () => null)
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerDataClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "user_role_assignments") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: async () => ({ data: globalRoleKeys.map((role_key) => ({ roles: { role_key } })) })
              })
            })
          })
        };
      }
      if (table === "project_members") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: projectMemberships.map((m) => ({ project_id: m.projectId, roles: { role_key: m.roleKey } }))
              })
            })
          })
        };
      }
      throw new Error(`unexpected table ${table}`);
    }
  }))
}));

import { requirePermission, canCreateProject } from "./rbac";

describe("global permission checks do not leak from project-scoped roles", () => {
  beforeEach(() => {
    globalRoleKeys = [];
    projectMemberships = [];
  });

  it("denies project.create for a profile whose only project_manager grant is project-scoped", async () => {
    projectMemberships = [{ projectId: "project-a", roleKey: "project_manager" }];

    const result = await requirePermission("project.create");
    expect(result.allowed).toBe(false);
  });

  it("denies canCreateProject() the same way", async () => {
    projectMemberships = [{ projectId: "project-a", roleKey: "project_manager" }];

    expect(await canCreateProject()).toBe(false);
  });

  it("allows project.create for a profile with a genuine GLOBAL project_manager assignment", async () => {
    globalRoleKeys = ["project_manager"];

    const result = await requirePermission("project.create");
    expect(result.allowed).toBe(true);
    expect(await canCreateProject()).toBe(true);
  });

  it("allows project.create for super_admin regardless of project memberships", async () => {
    globalRoleKeys = ["super_admin"];
    projectMemberships = [{ projectId: "project-a", roleKey: "customer_viewer" }];

    const result = await requirePermission("project.create");
    expect(result.allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w @tomp/web -- lib/auth/rbac.test.ts`
Expected: the first two tests FAIL (currently `allowed: true` because the project-scoped `project_manager` role leaks in); the last two already pass.

- [ ] **Step 3: Fix `requirePermission` and `canCreateProject`**

In `apps/web/lib/auth/rbac.ts`, replace lines 14-20:

```typescript
  // Global/org-scoped permissions (e.g. project.create) are never granted through
  // project_members — check ONLY global roles (user_role_assignments with no
  // project_id), never the flattened getUserRoles(), which unions in every
  // project-scoped role a profile holds anywhere. A project_manager grant on
  // one project must never imply platform-wide project-creation rights.
  if (!projectId || isGlobalPermission(permissionKey)) {
    const profile = await getCurrentUserProfile();
    if (profile.isDevelopmentFallback) return { allowed: true };
    const roles = await getGlobalRoleKeys(profile.id);
    const allowed = roles.some((roleKey) => roleHasPermission(roleKey, permissionKey));
    return allowed ? { allowed: true } : { allowed: false, reason: `No role includes ${permissionKey}.` };
  }
```

(`getGlobalRoleKeys` is already defined later in this same file and already exported — no new import needed, but its definition is below this call site; confirm it's hoisted correctly since both are `function`/`async function` declarations, which hoist — if TypeScript or the linter complains about use-before-definition, move `getGlobalRoleKeys`'s definition above `requirePermission` instead of adding a forward reference workaround.)

Replace `canCreateProject()` (lines 112-117):

```typescript
export async function canCreateProject(): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  if (profile.isDevelopmentFallback) return true;
  const roles = await getGlobalRoleKeys(profile.id);
  return roles.some((roleKey) => roleHasPermission(roleKey, "project.create"));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w @tomp/web -- lib/auth/rbac.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Fix the UI-visibility mismatch in `/projects/page.tsx`**

`apps/web/app/(app)/projects/page.tsx:24` currently computes `canCreate` from the raw flattened `permissions` array (`getViewerAccess()`'s `permissions`, same root cause, cosmetic-only here since the action re-checks correctly, but still shows a "สร้างโครงการ" button to people whose click will now correctly fail). Read the current file, then replace:

```typescript
  const canCreate = permissions.includes("*") || permissions.includes("project.create");
```

with:

```typescript
  const canCreate = await canCreateProject();
```

Add the import: `import { canCreateProject } from "@/lib/auth/rbac";`. Since `canCreateProject()` is itself `async`, and this is a Server Component, this is a normal `await` inside the existing async function body — no other change needed. Leave `canManage` (line 23, `project.update`, project-scoped, not a `GLOBAL_PERMISSIONS` key) untouched — that flattening is a separate, lower-stakes, UI-only looseness (shows an archive button that then correctly re-checks per-project) explicitly out of scope for this task.

- [ ] **Step 6: Run the full verification suite**

Run: `rm -rf apps/web/.next && npm run typecheck -w @tomp/web && npm run lint -w @tomp/web && npm run test -w @tomp/web`
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/auth/rbac.ts apps/web/lib/auth/rbac.test.ts "apps/web/app/(app)/projects/page.tsx"
git commit -m "Close project.create leak: global permissions check global roles only"
```

---

## Task 2: Self-service password change

**Files:**
- Create: `apps/web/app/(app)/account/password/page.tsx`
- Create: `apps/web/app/actions/account.ts`
- Create: `apps/web/app/actions/account.test.ts`
- Modify: `apps/web/components/auth/user-menu.tsx`

**Interfaces:**
- Produces: `changeOwnPasswordAction(input: unknown): Promise<ActionResult>` — validates `newPassword`/`confirmPassword` (zod, min 8 chars, must match), reads the current session via `getCurrentUserProfile()`, refuses if `profile.authUserId` is null (a project-helper or driver profile has no password to change — these never reach this page in normal navigation, but the action itself must still refuse defensively), calls `client.auth.admin.updateUserById(profile.authUserId, { password })` via `getSupabaseServerDataClient()` (the same service-role client `resetUserPassword` in `lib/superadmin/users.ts` already uses for the identical Admin API call — mirror that file's error-message pattern).
- Consumed by: the new `/account/password` page's form, and a new link in `UserMenu`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/app/actions/account.test.ts
import { describe, expect, it, vi } from "vitest";

const updateUserByIdMock = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUserProfile: vi.fn(async () => ({ id: "profile-1", authUserId: "auth-1", isDevelopmentFallback: false }))
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerDataClient: vi.fn(() => ({
    auth: { admin: { updateUserById: updateUserByIdMock } }
  }))
}));

import { changeOwnPasswordAction } from "./account";

describe("changeOwnPasswordAction", () => {
  it("rejects when the two fields don't match", async () => {
    const result = await changeOwnPasswordAction({ newPassword: "aVeryLongPassword1", confirmPassword: "different" });
    expect(result.success).toBe(false);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than 8 characters", async () => {
    const result = await changeOwnPasswordAction({ newPassword: "short1", confirmPassword: "short1" });
    expect(result.success).toBe(false);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("updates the current user's own auth account on a valid matching password", async () => {
    const result = await changeOwnPasswordAction({ newPassword: "aVeryLongPassword1", confirmPassword: "aVeryLongPassword1" });
    expect(result.success).toBe(true);
    expect(updateUserByIdMock).toHaveBeenCalledWith("auth-1", { password: "aVeryLongPassword1" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w @tomp/web -- app/actions/account.test.ts`
Expected: FAIL — `./account` does not exist.

- [ ] **Step 3: Implement the action**

```typescript
// apps/web/app/actions/account.ts
"use server";

import { z } from "zod";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

const changePasswordSchema = z
  .object({
    newPassword: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
    confirmPassword: z.string()
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "รหัสผ่านทั้งสองช่องไม่ตรงกัน",
    path: ["confirmPassword"]
  });

// Self-service password change for the SIGNED-IN account only — never takes a
// target profile id. A project-helper or driver profile (auth_user_id null,
// docs/11-codex/984's "lightweight" grant path) never reaches this page
// through normal navigation, but the action itself still refuses defensively
// rather than trusting the caller.
export async function changeOwnPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return actionFailure(parsed.error.issues[0]?.message || "ข้อมูลไม่ถูกต้อง", parsed.error.flatten().fieldErrors);

  const profile = await getCurrentUserProfile();
  if (!profile.authUserId) return actionFailure("บัญชีนี้ไม่มีการเข้าสู่ระบบด้วยรหัสผ่าน");

  const client = getSupabaseServerDataClient();
  if (!client) return actionFailure("ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล");

  const { error } = await client.auth.admin.updateUserById(profile.authUserId, { password: parsed.data.newPassword });
  if (error) return actionFailure(`เปลี่ยนรหัสผ่านไม่สำเร็จ: ${error.message}`);

  return actionSuccess({});
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w @tomp/web -- app/actions/account.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Build the page**

Read `apps/web/app/(app)/superadmin/users/page.tsx` and `apps/web/components/superadmin/reset-password-button.tsx` first for the established form/feedback pattern (client component, `useTransition`, `ActionFeedback`) before writing this — match it rather than inventing a new shape.

```typescript
// apps/web/app/(app)/account/password/page.tsx
import { PageHeader } from "@/components/page-header";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { AccessDenied } from "@/components/auth/access-denied";

export default async function AccountPasswordPage() {
  const profile = await getCurrentUserProfile();
  if (!profile.authUserId) {
    return <AccessDenied title="ไม่มีการเข้าสู่ระบบด้วยรหัสผ่าน" reason="บัญชีนี้ไม่ได้เข้าสู่ระบบด้วยอีเมล/รหัสผ่าน จึงไม่มีรหัสผ่านให้เปลี่ยน" />;
  }
  return (
    <>
      <PageHeader eyebrow="บัญชีของฉัน" title="เปลี่ยนรหัสผ่าน" description="ตั้งรหัสผ่านใหม่สำหรับบัญชีนี้" />
      <ChangePasswordForm />
    </>
  );
}
```

```typescript
// apps/web/components/account/change-password-form.tsx
"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { changeOwnPasswordAction } from "@/app/actions/account";
import { ActionFeedback } from "@/components/ui/action-feedback";

export function ChangePasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "danger">("danger");
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await changeOwnPasswordAction({
        newPassword: formData.get("newPassword"),
        confirmPassword: formData.get("confirmPassword")
      });
      if (result.success) {
        setTone("success");
        setMessage("เปลี่ยนรหัสผ่านแล้ว ใช้รหัสผ่านใหม่ในการเข้าสู่ระบบครั้งถัดไป");
      } else {
        setTone("danger");
        setMessage(result.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      }
    });
  }

  return (
    <form action={submit} className="enterprise-panel grid content-start gap-4 p-4 max-w-md">
      <label className="field-label">
        รหัสผ่านใหม่
        <input className="field-input" name="newPassword" type="password" required minLength={8} placeholder="อย่างน้อย 8 ตัวอักษร" />
      </label>
      <label className="field-label">
        ยืนยันรหัสผ่านใหม่
        <input className="field-input" name="confirmPassword" type="password" required minLength={8} placeholder="พิมพ์ซ้ำอีกครั้ง" />
      </label>
      <ActionFeedback message={message} tone={tone} />
      <button
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-panel bg-operation px-5 text-sm font-semibold text-white transition hover:bg-operation-deep disabled:bg-slate-300"
        disabled={isPending}
        type="submit"
      >
        <KeyRound className="h-4 w-4" />
        {isPending ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
      </button>
    </form>
  );
}
```

(Adjust class names to whatever `reset-password-button.tsx`/`invite-user-form.tsx` actually use if they differ from this sketch — read those files first per the instruction above and match their real, current classes exactly rather than this plan's best guess.)

- [ ] **Step 6: Link it from `UserMenu`**

In `apps/web/components/auth/user-menu.tsx`, add a small icon-link next to the existing logout button inside the signed-in identity block (the `<button onClick={handleLogout}>` block, lines 69-79). Add a `KeyRound` icon import from `lucide-react` and a `<Link href="/account/password" title="เปลี่ยนรหัสผ่าน">` styled consistently with the adjacent logout button (same size classes, same `dark`/`light` variant branching already used for every other element in this component) placed immediately before the logout button.

- [ ] **Step 7: Verify and commit**

Run: `rm -rf apps/web/.next && npm run typecheck -w @tomp/web && npm run lint -w @tomp/web && npm run test -w @tomp/web`

```bash
git add apps/web/app/actions/account.ts apps/web/app/actions/account.test.ts "apps/web/app/(app)/account/password/page.tsx" apps/web/components/account/change-password-form.tsx apps/web/components/auth/user-menu.tsx
git commit -m "Add self-service password change"
```

---

## Task 3: Consolidate account creation onto one path; add the missing global project_manager grant

**Files:**
- Create: `database/migrations/0049_global_project_manager_role.sql` (documents the intent; the role itself already exists — see below)
- Modify: `apps/web/components/superadmin/invite-user-form.tsx`
- Modify: `apps/web/lib/superadmin/users.ts`
- Modify: `apps/web/app/(app)/project/page.tsx` OR wherever the dangling "เพิ่ม/จัดการผู้ใช้" link still points at `/superadmin/users` (grep first — see Step 1)
- Test: `apps/web/lib/superadmin/users.test.ts` (extend existing)

**Design decision, made from the evidence gathered (not re-litigated with the user — this was the user's own explicit "proceed" on the recommended direction):** `/superadmin/users`'s `InviteUserForm` currently offers two "kind"s — "staff" (project-scoped role, requires an existing project) and "admin" (`super_admin`, sees everything). There is no middle tier, which is the literal gap the user's original complaint described ("an account that isn't super admin but CAN create projects"). Per Task 1, `project.create` now correctly requires a GLOBAL role assignment (`user_role_assignments`, `project_id is null`) — `project_manager` already has `project.create` in `ROLE_PERMISSIONS`, and `create_project_command()` (migration `0047`) already auto-grants the creator project-scoped `project_manager` on whatever they create. So the missing piece is purely a UI path to grant `project_manager` as a GLOBAL role, not a new role or new RPC.

Fix: add a third `kind` to the invite form — "ผู้จัดการโครงการ (สร้างโครงการเองได้)" — granting `globalRoleKey: "project_manager"` via the exact same `user_role_assignments`-insert code path `provisionUser()` already uses for `super_admin` (that code is already role-key-agnostic — verify this by reading it, it should need zero change, only a new caller). Remove the "staff" (project-scoped) kind's project-selection capability from this page entirely — project-scoped granting is strictly better served by each project's own Settings tab (`AddProjectMemberForm`, built in the prior central-permission-system plan): it supports both Ground Transfer and Airport Transfer roles (this page only ever supported Ground Transfer's four), enforces the same security-hardened per-system role allowlist, and is reachable by a `project_manager` directly (not gated behind `super_admin`). Keep this page for what only `super_admin` can do: granting `super_admin` itself, and now granting the global `project_manager` tier.

- [ ] **Step 1: Find and confirm the scope of the dangling link**

Run: `grep -rn '"/superadmin/users"' apps/web/app apps/web/components --include=*.tsx`
Read every match. If any of them is the "เพิ่ม/จัดการผู้ใช้" project-Settings-page link this plan's predecessor already fixed (it shouldn't be — that was fixed in the central-permission-system work — but confirm), leave it; if a *different* stale reference exists pointing someone toward this page for project-scoped granting, update its copy to point at the project's own Settings tab instead, or remove it if it's now fully redundant.

- [ ] **Step 2: Confirm `provisionUser()` is already role-key-agnostic for the global-role path**

Read `apps/web/lib/superadmin/users.ts:162-170` (the `if (input.globalRoleKey) { ... insert user_role_assignments ... }` block). Confirm it inserts whatever `role_id` corresponds to `input.globalRoleKey` — no `super_admin`-specific branching. If it IS already generic (expected), no change needed here. If it has a hidden `super_admin`-only assumption, fix it to accept any valid global role key the caller passes (still validated against the `roles` table lookup already present at lines 124-130 — that part already accepts any role key that exists in `public.roles`, so this should just work for `project_manager` too).

- [ ] **Step 3: Rewrite `InviteUserForm`**

Read the current full file (`apps/web/components/superadmin/invite-user-form.tsx`) before editing — this plan describes the target shape, not a literal diff, since the file's exact current styling classes need to be matched.

Target shape: `kind: "staff_notice" | "project_manager" | "admin"`.
- `"project_manager"` (new, replaces the old "staff" radio's actual capability): submits `globalRoleKey: "project_manager"`, no project selection UI at all.
- `"admin"`: unchanged, submits `globalRoleKey: "super_admin"`.
- The old "staff" project-scoped option is removed from this form. In its place, where that radio used to be, add a **non-interactive notice card** (not a radio option — nothing to submit) explaining: "ต้องการเพิ่มคนเข้าทำงานในโครงการที่มีอยู่แล้ว (ไม่ใช่สร้างโครงการเอง)? ไปที่หน้า **ตั้งค่า** ของโครงการนั้นแทน" with a link to `/projects` (the project list — there's no single canonical settings URL to link to since it's per-project; linking to the list is the correct "go pick a project" affordance, matching the same pattern the landing-page-tile flow already uses elsewhere).

Remove: the `projects` prop (no longer used by this component — check `apps/web/app/(app)/superadmin/users/page.tsx` for where it's passed in and remove that too if nothing else in that page needs the project list), the `PROJECT_ROLES`/`PROJECT_ROLE_HINT` constants, the project `<select>` and its `required` validation.

- [ ] **Step 4: Update the server action wiring**

Read `apps/web/app/actions/superadmin-users.ts` (the thin action wrapper `provisionUserAction` that `InviteUserForm` calls). Confirm it passes `globalRoleKey` through to `provisionUser()` unchanged for the new `"project_manager"` kind (it already does this generically for `"admin"` → `super_admin` per the current code — the new kind just supplies a different string, no wrapper change should be needed; verify, don't assume).

- [ ] **Step 5: Extend the test suite**

Read `apps/web/lib/superadmin/users.test.ts` (exists already — extend it, following its established mocking pattern) with a case proving `provisionUser({ ..., globalRoleKey: "project_manager" })` inserts a `user_role_assignments` row with `project_id: null` and the `project_manager` role id — i.e., a genuinely global grant, not a project-scoped one — mirroring whatever assertion shape the existing `super_admin` case in that file already uses.

- [ ] **Step 6: Write the migration doc-note**

`0049_global_project_manager_role.sql` — this migration does **not** add a new role (`project_manager` already exists in `public.roles` from `0004_auth_rbac_foundation.sql`) or change any schema. Its only content is a comment recording the decision, plus a defensive `on conflict do nothing` re-insert of the `project_manager` role row (a no-op today, cheap insurance against a future migration ever having dropped it):

```sql
-- 0049_global_project_manager_role.sql
-- No schema change. Records the decision that closed the audit item "an
-- account that isn't super_admin but can create projects doesn't really
-- work": project_manager already carries project.create in ROLE_PERMISSIONS
-- and create_project_command() (0047) already auto-grants the creator
-- project-scoped project_manager on whatever they create — the only gap was
-- a UI path to grant project_manager as a GLOBAL role (user_role_assignments,
-- project_id null). apps/web/components/superadmin/invite-user-form.tsx now
-- offers this directly. No new role, no new table, no new RPC needed.
insert into public.roles (role_key, role_name, description)
values ('project_manager', 'Project Manager', 'Project-scoped or, with a global grant, platform-wide project creation and management.')
on conflict (role_key) do nothing;
```

Copy to `supabase/migrations/0049_global_project_manager_role.sql` (identical content — do not apply either copy, per this worktree's execution mode).

- [ ] **Step 7: Verify and commit**

Run: `rm -rf apps/web/.next && npm run typecheck -w @tomp/web && npm run lint -w @tomp/web && npm run test -w @tomp/web`

```bash
git add apps/web/components/superadmin/invite-user-form.tsx apps/web/lib/superadmin/users.ts apps/web/lib/superadmin/users.test.ts apps/web/app/actions/superadmin-users.ts "apps/web/app/(app)/superadmin/users/page.tsx" database/migrations/0049_global_project_manager_role.sql supabase/migrations/0049_global_project_manager_role.sql
git commit -m "Consolidate account creation: global project_manager grant, remove redundant project-scoped path from /superadmin/users"
```

---

## Task 4: Loading-state coverage

**Files:**
- Create: `apps/web/app/(app)/loading.tsx`
- Create: `apps/web/app/loading.tsx`

**Interfaces:** None — pure Next.js file-convention additions. Next.js renders the nearest ancestor `loading.tsx` as a Suspense fallback automatically for every route segment beneath it; no per-page wiring needed. `apps/web/app/error.tsx` already exists and is good (confirmed by reading it) — this task does not touch error boundaries, only loading ones, since `grep`-confirmed zero `loading.tsx` files exist anywhere in the app today.

- [ ] **Step 1: The authenticated-shell loading state**

```typescript
// apps/web/app/(app)/loading.tsx
export default function AppLoading() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="grid place-items-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-operation border-t-transparent" />
        <p className="text-sm text-slate-500">กำลังโหลด...</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: The public-route loading state**

Read `apps/web/app/layout.tsx` and `apps/web/app/error.tsx` first to match the root layout's outer chrome (background color, container) so this doesn't flash a mismatched background against the existing error page's styling.

```typescript
// apps/web/app/loading.tsx
export default function RootLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50">
      <div className="grid place-items-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-operation border-t-transparent" />
        <p className="text-sm text-slate-500">กำลังโหลด...</p>
      </div>
    </main>
  );
}
```

(If `apps/web/app/error.tsx`'s actual background/container classes differ from `bg-slate-50` + a centered `<main>`, match those exact classes instead of this plan's guess — the two should look like the same product, not two different designs.)

- [ ] **Step 3: Manual smoke check**

Since Suspense-fallback timing is hard to unit-test meaningfully for a static loading skeleton, verify by reading (not testing): confirm neither new file exports anything but a default component, confirm no data-fetching or client-only hooks were accidentally added (a `loading.tsx` must stay a trivial server component — no `"use client"`, no props).

Run: `rm -rf apps/web/.next && npm run typecheck -w @tomp/web && npm run lint -w @tomp/web && npm run build -w @tomp/web`
Expected: build succeeds and the route manifest includes both new files' effect (no visible new routes — `loading.tsx` doesn't add a route, just verify the build doesn't error).

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(app)/loading.tsx" apps/web/app/loading.tsx
git commit -m "Add loading-state coverage for the authenticated shell and public routes"
```

---

## Task 5: Landing page skips itself when only one system is unlocked

**Files:**
- Modify: `apps/web/app/(app)/page.tsx`
- Test: `apps/web/app/(app)/page.test.ts` (new file)

**Interfaces:**
- `RootPage` (unchanged export name/shape as a page component) now redirects immediately to `/${system.route}` when `viewerSystems` (after the existing `super_admin` bypass) contains exactly one of the currently-active `systems` rows, and renders the existing tile picker only when it contains two or more. Zero unlocked systems still renders the existing all-locked tile view unchanged (nothing to redirect to).

Read the current file in full first (it now has the `SYSTEM_COPY` additions from commit `5244c1a` — build on that, don't revert it).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/app/(app)/page.test.ts
import { describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({ redirectMock: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }) }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const systemsRows = [
  { key: "ground_transfer", label_th: "ระบบจัดการรถรับส่ง", icon: "CarFront", route: "ground-transfer", is_active: true, sort_order: 0 },
  { key: "airport_transfer", label_th: "ระบบรับส่งสนามบิน", icon: "PlaneTakeoff", route: "airport-transfer", is_active: true, sort_order: 1 }
];

let viewerSystemKeys: string[] = [];
let roleKeys: string[] = [];

vi.mock("@/lib/supabase/scoped-client", () => ({
  resolveReadClient: vi.fn(async () => ({
    client: {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({ data: systemsRows })
          })
        })
      })
    }
  }))
}));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserProfile: vi.fn(async () => ({ id: "profile-1" })) }));
vi.mock("@/lib/auth/access", () => ({ getViewerAccess: vi.fn(async () => ({ roleKeys })) }));
vi.mock("@/lib/data/project-systems", () => ({ getViewerSystemKeys: vi.fn(async () => viewerSystemKeys) }));

import RootPage from "./page";

describe("RootPage single-system skip", () => {
  it("redirects straight to the one unlocked system instead of showing the tile picker", async () => {
    viewerSystemKeys = ["ground_transfer"];
    roleKeys = ["project_manager"];

    await expect(RootPage()).rejects.toThrow("REDIRECT:/ground-transfer");
  });

  it("renders the tile picker when two or more systems are unlocked", async () => {
    viewerSystemKeys = ["ground_transfer", "airport_transfer"];
    roleKeys = ["project_manager"];

    const element = await RootPage();
    expect(element).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("renders the (all-locked) tile picker when zero systems are unlocked, not a redirect", async () => {
    viewerSystemKeys = [];
    roleKeys = ["customer_viewer"];

    const element = await RootPage();
    expect(element).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("super_admin with only one ACTIVE system in the registry still redirects (bypass unlocks all active systems, and there's only one)", async () => {
    systemsRows.pop();
    viewerSystemKeys = [];
    roleKeys = ["super_admin"];

    await expect(RootPage()).rejects.toThrow("REDIRECT:/ground-transfer");

    systemsRows.push({ key: "airport_transfer", label_th: "ระบบรับส่งสนามบิน", icon: "PlaneTakeoff", route: "airport-transfer", is_active: true, sort_order: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w @tomp/web -- "app/(app)/page.test.ts"`
Expected: FAIL — `RootPage` doesn't redirect today regardless of unlock count.

- [ ] **Step 3: Implement**

In `apps/web/app/(app)/page.tsx`, add the `redirect` import from `next/navigation` and, immediately after computing `viewerSystems` (the existing `const viewerSystems = isSuperAdmin ? ... : await getViewerSystemKeys(profile.id);` line), add:

```typescript
  const unlockedSystems = systems.filter((system) => viewerSystems.includes(system.key));
  if (unlockedSystems.length === 1) {
    redirect(`/${unlockedSystems[0]!.route}`);
  }
```

Place this before the `return (...)` JSX block, after the existing `viewerSystems` computation. No other change to the file — the existing tile-rendering JSX (with its `unlocked`/`copy` logic) is unchanged and still runs correctly for the 0-unlocked and 2+-unlocked cases, since `redirect()` throws (Next.js's control-flow mechanism) and short-circuits execution for the 1-unlocked case before that JSX is reached.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w @tomp/web -- "app/(app)/page.test.ts"`
Expected: PASS, 4/4.

- [ ] **Step 5: Verify and commit**

Run: `rm -rf apps/web/.next && npm run typecheck -w @tomp/web && npm run lint -w @tomp/web && npm run test -w @tomp/web`

```bash
git add "apps/web/app/(app)/page.tsx" "apps/web/app/(app)/page.test.ts"
git commit -m "Skip the landing tile picker when exactly one system is unlocked"
```

---

## Task 6: UI consistency audit — account/permission management surfaces

**Scope, deliberately bounded:** the other active track (commits `7ac61a5`..`5244c1a`, landed between this plan's authoring and now) has been actively polishing the operations/dispatch/resources/driver UI — auditing those pages now would duplicate or collide with work already in flight. This task instead covers the surfaces THIS plan's own tasks already touch or that were flagged in the original audit and are NOT part of that other track's visible work: `/superadmin/users` (rewritten in Task 3), `/permission/*` (the oversight pages), the landing page (Task 5), and the new `/account/password` page (Task 2) — checking they read as one coherent product, not bolted-on pieces from different sessions.

**Files:** read-only investigation first; fixes land as small, targeted edits to whichever specific files the investigation finds genuinely inconsistent. No files are pre-declared here because the point of an audit is that you don't know the target list until you've looked — but every fix must cite the specific pattern it's matching (an existing, already-used class name or component), never introduce a new one-off style.

- [ ] **Step 1: Read the current state of every page in scope**

After Tasks 2/3/5 land (this task runs last, deliberately, so it audits the *actual* shipped result, not a plan's prediction of it): read `apps/web/app/(app)/superadmin/users/page.tsx`, the rewritten `invite-user-form.tsx`, `apps/web/app/(app)/permission/{projects,audit,roles}/page.tsx`, `apps/web/app/(app)/page.tsx`, `apps/web/app/(app)/account/password/page.tsx`, and `apps/web/components/superadmin/user-list.tsx`.

- [ ] **Step 2: Check for these specific, common drift patterns**

For each file read in Step 1, check:
- Does every panel/card use `enterprise-panel` (or its documented siblings `enterprise-panel-soft`) rather than a one-off `border rounded-xl bg-white p-4`-style inline reconstruction of the same thing?
- Does every empty state use `components/ui/empty-state.tsx`'s `<EmptyState>` rather than a hand-rolled `<div><Icon /><p>...</p></div>`?
- Does every status indicator use `components/ui/status-badge.tsx`/`status-dot.tsx` rather than a raw colored `<span>`?
- Is spacing consistent (`gap-4` between major sections, `p-4` panel padding) with the surrounding pages already read this session (`projects/page.tsx`, the project Settings page)?
- Is every Thai string's tone/register consistent with the surrounding copy (direct, no unexplained jargon, matches the existing `PageHeader` `eyebrow`/`title`/`description` three-part pattern already used on every other page in this app)?

- [ ] **Step 3: Fix what's found, cite the pattern each fix matches**

For each deviation found, fix it as its own small commit-worthy change, and in the commit message or a code comment, name the existing file/pattern being matched (e.g. "matches the panel style already used in `projects/[projectCode]/settings/page.tsx`"). Do not introduce new visual patterns not already established somewhere else in this app — this task is about consistency, not redesign.

- [ ] **Step 4: Report anything found that needs a bigger call**

If the audit surfaces something that isn't a small consistency fix but a genuine design gap (e.g., `/permission/audit` has no empty state at all, or the `UserList` component's table has no responsive/mobile treatment) — do not silently redesign it. Note it in the task's final report as a flagged item for the user, the same way the original 2026-09-22 audit flagged items rather than fixing them unilaterally.

- [ ] **Step 5: Verify and commit**

Run: `rm -rf apps/web/.next && npm run typecheck -w @tomp/web && npm run lint -w @tomp/web && npm run test -w @tomp/web`

```bash
git add -A
git commit -m "UI consistency pass on account/permission surfaces"
```

---

## Self-review notes

- **Task ordering matters**: Task 3 depends on Task 1 (the global `project_manager` grant path Task 3 adds is what keeps closing the `project.create` leak in Task 1 from being a net regression for real accounts that need to create projects). Task 6 explicitly runs last so it audits the real shipped state of Tasks 2/3/5, not a prediction. Tasks 2 and 4 have no dependencies and could run in any order relative to the others.
- **Placeholder scan**: no "TBD"/"TODO" found in this plan; Task 6 is intentionally open-ended in its file list (an audit task cannot pre-declare exactly which files it will edit) but every step in it has a concrete, checkable instruction, not a vague "improve UX" directive.
- **Type/interface consistency checked**: `changeOwnPasswordAction`, `requirePermission`, `canCreateProject`, and the `RootPage` redirect logic all match the exact function names/signatures already live in the current codebase (verified by reading the real files during this plan's authoring, not assumed from memory).
- **Item 7 (bilingual rollout) is explicitly excluded per the user's own instruction** — no task in this plan touches Thai-only strings as a translation concern (Task 6's copy-consistency check is about *tone*, not language coverage).
