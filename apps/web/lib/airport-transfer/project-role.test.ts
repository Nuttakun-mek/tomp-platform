import { describe, expect, it, vi } from "vitest";
import { getAirportTransferProjectRole } from "./project-role";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerDataClient: vi.fn()
}));

import { getSupabaseServerDataClient } from "@/lib/supabase/server";

describe("getAirportTransferProjectRole", () => {
  it("returns the role_key for that project + system with correct query chain", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { roles: { role_key: "airport_driver" } } });
    const eq4 = vi.fn().mockReturnValue({ maybeSingle });
    const eq3 = vi.fn().mockReturnValue({ eq: eq4 });
    const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    const from = vi.fn().mockReturnValue({ select });
    (getSupabaseServerDataClient as ReturnType<typeof vi.fn>).mockReturnValue({ from });

    const role = await getAirportTransferProjectRole("project-1", "profile-1");

    expect(role).toBe("airport_driver");
    expect(from).toHaveBeenCalledWith("project_members");
    expect(select).toHaveBeenCalledWith(expect.stringContaining("role_key"));
    expect(eq1).toHaveBeenCalledWith("project_id", "project-1");
    expect(eq2).toHaveBeenCalledWith("profile_id", "profile-1");
    expect(eq3).toHaveBeenCalledWith("system_key", "airport_transfer");
    expect(eq4).toHaveBeenCalledWith("status", "active");
  });

  it("returns null when there is no membership row", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const eq4 = vi.fn().mockReturnValue({ maybeSingle });
    const eq3 = vi.fn().mockReturnValue({ eq: eq4 });
    const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    const from = vi.fn().mockReturnValue({ select });
    (getSupabaseServerDataClient as ReturnType<typeof vi.fn>).mockReturnValue({ from });

    const role = await getAirportTransferProjectRole("project-1", "profile-1");

    expect(role).toBeNull();
    expect(from).toHaveBeenCalledWith("project_members");
    expect(select).toHaveBeenCalledWith(expect.stringContaining("role_key"));
    expect(eq1).toHaveBeenCalledWith("project_id", "project-1");
    expect(eq2).toHaveBeenCalledWith("profile_id", "profile-1");
    expect(eq3).toHaveBeenCalledWith("system_key", "airport_transfer");
    expect(eq4).toHaveBeenCalledWith("status", "active");
  });
});
