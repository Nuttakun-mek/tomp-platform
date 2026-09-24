import { beforeEach, describe, expect, it, vi } from "vitest";

const resetUserPasswordMock = vi.fn(async (_id: string) => ({ ok: true as const, tempPassword: "temp-123" }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/rbac", () => ({ requirePermission: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserProfile: vi.fn(async () => ({ id: "me" })) }));
vi.mock("@/lib/superadmin/users", () => ({
  provisionUser: vi.fn(),
  validateProvisionInput: vi.fn(),
  resetUserPassword: (id: string) => resetUserPasswordMock(id)
}));

import { resetUserPasswordAction } from "./superadmin-users";

describe("resetUserPasswordAction", () => {
  beforeEach(() => resetUserPasswordMock.mockClear());

  it("refuses to reset the signed-in admin's own password", async () => {
    const result = await resetUserPasswordAction("me");
    expect(result.success).toBe(false);
    expect(resetUserPasswordMock).not.toHaveBeenCalled();
  });

  it("resets another user's password", async () => {
    const result = await resetUserPasswordAction("someone-else");
    expect(result.success).toBe(true);
    expect(resetUserPasswordMock).toHaveBeenCalledWith("someone-else");
  });
});
