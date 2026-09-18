import { describe, expect, it, vi } from "vitest";
import { getAirportTransferProjectRole } from "./project-role";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerDataClient: vi.fn()
}));

import { getSupabaseServerDataClient } from "@/lib/supabase/server";

describe("getAirportTransferProjectRole", () => {
  it("returns the role_key for that project + system", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { roles: { role_key: "airport_driver" } } });
    const chain = { select: () => chain, eq: () => chain, maybeSingle };
    (getSupabaseServerDataClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: () => chain });

    const role = await getAirportTransferProjectRole("project-1", "profile-1");
    expect(role).toBe("airport_driver");
  });

  it("returns null when there is no membership row", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const chain = { select: () => chain, eq: () => chain, maybeSingle };
    (getSupabaseServerDataClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: () => chain });

    const role = await getAirportTransferProjectRole("project-1", "profile-1");
    expect(role).toBeNull();
  });
});
