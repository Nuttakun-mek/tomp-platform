import { beforeEach, describe, expect, it, vi } from "vitest";

const updateUserByIdMock = vi.fn(async () => ({ error: null }));

const getCurrentUserProfileMock = vi.fn(async (): Promise<{ id: string; authUserId: string | null; isDevelopmentFallback: boolean }> => ({
  id: "profile-1",
  authUserId: "auth-1",
  isDevelopmentFallback: false
}));

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUserProfile: () => getCurrentUserProfileMock()
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerDataClient: vi.fn(() => ({
    auth: { admin: { updateUserById: updateUserByIdMock } }
  }))
}));

import { changeOwnPasswordAction } from "./account";

describe("changeOwnPasswordAction", () => {
  beforeEach(() => {
    updateUserByIdMock.mockClear();
    getCurrentUserProfileMock.mockClear();
  });

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

  it("refuses for a profile with no authUserId (driver/project-helper login)", async () => {
    getCurrentUserProfileMock.mockResolvedValueOnce({ id: "profile-2", authUserId: null, isDevelopmentFallback: false });
    const result = await changeOwnPasswordAction({ newPassword: "aVeryLongPassword1", confirmPassword: "aVeryLongPassword1" });
    expect(result.success).toBe(false);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });
});
