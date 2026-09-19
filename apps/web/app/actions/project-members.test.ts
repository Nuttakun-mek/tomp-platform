import { describe, expect, it, vi } from "vitest";

// requirePermission always DENIES here, with a message this test can tell
// apart from a validation-layer rejection. That lets each case below prove,
// unambiguously, WHERE a roleKey was rejected:
//   - a disallowed role never reaches requirePermission at all (schema
//     rejects it first) -> error is the validation message
//   - an allowed role passes validation and reaches requirePermission,
//     which this mock then denies -> error is "permission-check-reached"
// This is the regression test for the finding that anyone holding
// project.manage_members on ANY project could grant themselves
// roleKey: "super_admin" (present in `roles`, not gated by any allowlist
// before this fix) and become platform super_admin, since getUserRoles()
// unions every project_members role into a profile's GLOBAL role set.
vi.mock("@/lib/auth/rbac", () => ({
  requirePermission: vi.fn(async () => ({ allowed: false, reason: "permission-check-reached" }))
}));

const PROJECT_ID = "10000000-0000-4000-8000-000000000003";

import { addProjectMemberAction, issueProjectHelperAction } from "./project-members";

describe("addProjectMemberAction role allowlist", () => {
  it("rejects roleKey outside any system's allowlist (super_admin escalation)", async () => {
    const result = await addProjectMemberAction({
      projectId: PROJECT_ID,
      systemKey: "ground_transfer",
      roleKey: "super_admin",
      email: "attacker@example.com"
    });
    expect(result.success).toBe(false);
    expect(result.error).not.toBe("permission-check-reached");
    expect(result.fieldErrors?.roleKey).toBeTruthy();
  });

  it("rejects a role that belongs to the OTHER system (roleKey/systemKey mismatch)", async () => {
    const result = await addProjectMemberAction({
      projectId: PROJECT_ID,
      systemKey: "ground_transfer",
      roleKey: "airport_admin",
      email: "someone@example.com"
    });
    expect(result.success).toBe(false);
    expect(result.error).not.toBe("permission-check-reached");
    expect(result.fieldErrors?.roleKey).toBeTruthy();
  });

  it("rejects the ground_transfer 'driver' role (QR-flow-only, not grantable here)", async () => {
    const result = await addProjectMemberAction({
      projectId: PROJECT_ID,
      systemKey: "ground_transfer",
      roleKey: "driver",
      email: "someone@example.com"
    });
    expect(result.success).toBe(false);
    expect(result.fieldErrors?.roleKey).toBeTruthy();
  });

  it("passes validation for a role that IS on the systemKey's allowlist, reaching the permission gate", async () => {
    const result = await addProjectMemberAction({
      projectId: PROJECT_ID,
      systemKey: "ground_transfer",
      roleKey: "coordinator",
      email: "someone@example.com"
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("permission-check-reached");
  });

  it("passes validation for an airport_transfer role including airport_driver", async () => {
    const result = await addProjectMemberAction({
      projectId: PROJECT_ID,
      systemKey: "airport_transfer",
      roleKey: "airport_driver",
      email: "someone@example.com"
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("permission-check-reached");
  });
});

describe("issueProjectHelperAction role allowlist", () => {
  it("rejects roleKey: super_admin", async () => {
    const result = await issueProjectHelperAction({
      projectId: PROJECT_ID,
      systemKey: "airport_transfer",
      roleKey: "super_admin",
      fullName: "Attacker Helper",
      pin: "1234"
    });
    expect(result.success).toBe(false);
    expect(result.error).not.toBe("permission-check-reached");
    expect(result.fieldErrors?.roleKey).toBeTruthy();
  });

  it("rejects a role outside the given system's allowlist", async () => {
    const result = await issueProjectHelperAction({
      projectId: PROJECT_ID,
      systemKey: "airport_transfer",
      roleKey: "dispatcher",
      fullName: "Someone",
      pin: "1234"
    });
    expect(result.success).toBe(false);
    expect(result.fieldErrors?.roleKey).toBeTruthy();
  });

  it("passes validation for an allowed airport_transfer role, reaching the permission gate", async () => {
    const result = await issueProjectHelperAction({
      projectId: PROJECT_ID,
      systemKey: "airport_transfer",
      roleKey: "airport_coordinator",
      fullName: "Someone",
      pin: "1234"
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("permission-check-reached");
  });
});
