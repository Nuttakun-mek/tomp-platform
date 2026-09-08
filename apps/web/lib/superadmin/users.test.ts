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
