import { describe, expect, it, vi, beforeEach } from "vitest";

const insertedRoleAssignments: Array<Record<string, unknown>> = [];

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerDataClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            ilike: () => ({
              // No existing profile with this email.
              maybeSingle: async () => ({ data: null })
            })
          }),
          insert: async () => ({ error: null })
        };
      }
      if (table === "roles") {
        return {
          select: () => ({
            in: async (_col: string, keys: string[]) => ({
              data: keys.map((key) => ({ id: `role-id-${key}`, role_key: key }))
            })
          })
        };
      }
      if (table === "user_role_assignments") {
        return {
          insert: async (row: Record<string, unknown>) => {
            insertedRoleAssignments.push(row);
            return { error: null };
          }
        };
      }
      if (table === "project_members") {
        return {
          insert: async () => ({ error: null })
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    auth: {
      admin: {
        createUser: async () => ({ data: { user: { id: "auth-user-1" } }, error: null })
      }
    }
  }))
}));

import { provisionUser, validateProvisionInput } from "./users";

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

describe("provisionUser", () => {
  beforeEach(() => {
    insertedRoleAssignments.length = 0;
  });

  it("grants project_manager as a genuine GLOBAL role, not a project-scoped one", async () => {
    const result = await provisionUser({
      email: "new-pm@b.com",
      fullName: "ผู้จัดการโครงการ",
      organizationId: "00000000-0000-4000-8000-000000000001",
      globalRoleKey: "project_manager"
    });

    expect(result.ok).toBe(true);
    expect(insertedRoleAssignments).toHaveLength(1);
    const row = insertedRoleAssignments[0];
    expect(row.role_id).toBe("role-id-project_manager");
    // No project_id on the insert at all — the column is nullable with no
    // default, so omitting it is what makes this a GLOBAL grant (matching
    // the super_admin insert path this reuses unchanged).
    expect(row.project_id).toBeUndefined();
  });

  it("still supports granting super_admin via the same global-role path", async () => {
    const result = await provisionUser({
      email: "new-admin@b.com",
      fullName: "ผู้ดูแลระบบ",
      organizationId: "00000000-0000-4000-8000-000000000001",
      globalRoleKey: "super_admin"
    });

    expect(result.ok).toBe(true);
    expect(insertedRoleAssignments).toHaveLength(1);
    expect(insertedRoleAssignments[0].role_id).toBe("role-id-super_admin");
  });
});
