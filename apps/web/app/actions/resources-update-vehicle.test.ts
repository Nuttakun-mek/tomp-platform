import { beforeEach, describe, expect, it, vi } from "vitest";

let row: Record<string, unknown> | null = null;
const writes: Array<{ patch: Record<string, unknown>; id: unknown }> = [];

const client = {
  from() {
    let patch: Record<string, unknown> | null = null;
    const chain = {
      select: () => chain,
      update(next: Record<string, unknown>) {
        patch = next;
        return chain;
      },
      eq(_column: string, value: unknown) {
        if (patch) {
          writes.push({ patch, id: value });
          return Promise.resolve({ error: null });
        }
        return chain;
      },
      maybeSingle: () => Promise.resolve({ data: row, error: null })
    };
    return chain;
  }
};

const requirePermission = vi.fn<(...args: unknown[]) => Promise<{ allowed: boolean }>>(async () => ({ allowed: true }));
vi.mock("@/lib/auth/rbac", () => ({ requirePermission: (...args: unknown[]) => requirePermission(...args) }));
vi.mock("@/lib/supabase/server-write", () => ({ getSupabaseWriteClient: () => ({ client, error: null, mode: "supabase" }) }));
vi.mock("@/lib/timeline", () => ({ createTimelineEvent: vi.fn(), TIMELINE_EVENTS: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateVehicleAction } from "./resources";

const ID = "30000000-0000-4000-8000-000000000001";
const PROJECT = "10000000-0000-4000-8000-000000000003";
const input = { id: ID, plateNumber: "1กข 1234", vehicleType: "รถตู้", capacity: "10", brand: "Toyota", model: "Commuter", colour: "ขาว", icon: "vip" };

describe("updateVehicleAction", () => {
  beforeEach(() => {
    writes.length = 0;
    requirePermission.mockClear();
    row = { id: ID, project_id: PROJECT, metadata: { icon: "van", packageAmount: 3000, operationNote: "keep me" } };
  });

  it("checks permission on the vehicle's own project, not anything the request says", async () => {
    await updateVehicleAction({ ...input, projectId: "someone-elses-project" });
    expect(requirePermission).toHaveBeenCalledWith(PROJECT, "vehicle.create");
  });

  it("writes the edited fields and keeps the rest of the metadata", async () => {
    const result = await updateVehicleAction(input);
    expect(result.success).toBe(true);
    expect(writes[0]).toEqual({
      id: ID,
      patch: {
        plate_number: "1กข 1234",
        vehicle_type: "รถตู้",
        capacity: 10,
        metadata: { icon: "vip", packageAmount: 3000, operationNote: "keep me", brand: "Toyota", model: "Commuter", colour: "ขาว" }
      }
    });
  });

  it("keeps the old symbol when the one sent is not a known symbol", async () => {
    await updateVehicleAction({ ...input, icon: "spaceship" });
    expect((writes[0].patch.metadata as Record<string, unknown>).icon).toBe("van");
  });

  it("refuses a vehicle that does not exist", async () => {
    row = null;
    const result = await updateVehicleAction(input);
    expect(result.success).toBe(false);
    expect(writes).toHaveLength(0);
  });
});
