import { beforeEach, describe, expect, it, vi } from "vitest";

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
  beforeEach(() => {
    redirectMock.mockClear();
  });

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
