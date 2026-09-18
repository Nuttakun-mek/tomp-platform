import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/access", () => ({
  getViewerAccess: vi.fn().mockResolvedValue({
    profile: { authUserId: "auth-1", isDevelopmentFallback: false, id: "profile-1" },
    roleKeys: []
  })
}));
vi.mock("@/lib/airport-transfer/project-role", () => ({
  getAirportTransferProjectRole: vi.fn()
}));

import { getAirportTransferAccess } from "./access";
import { getAirportTransferProjectRole } from "./project-role";

describe("getAirportTransferAccess(projectId)", () => {
  it("grants canManage for airport_admin on the given project", async () => {
    (getAirportTransferProjectRole as ReturnType<typeof vi.fn>).mockResolvedValue("airport_admin");
    const access = await getAirportTransferAccess("project-1");
    expect(access).toMatchObject({ allowed: true, canManage: true, role: "airport_admin" });
  });

  it("denies canManage for airport_driver on the given project", async () => {
    (getAirportTransferProjectRole as ReturnType<typeof vi.fn>).mockResolvedValue("airport_driver");
    const access = await getAirportTransferAccess("project-1");
    expect(access).toMatchObject({ allowed: true, canManage: false, role: "airport_driver" });
  });

  it("denies access when the profile holds no role on this project", async () => {
    (getAirportTransferProjectRole as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const access = await getAirportTransferAccess("project-1");
    expect(access).toMatchObject({ allowed: false, canManage: false, role: null });
  });
});
