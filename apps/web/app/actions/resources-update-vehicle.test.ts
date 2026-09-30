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

import { updateDriverAction, updateVehicleAction } from "./resources";

const ID = "30000000-0000-4000-8000-000000000001";
const PROJECT = "10000000-0000-4000-8000-000000000003";
const input = { id: ID, plateNumber: "1กข 1234", vehicleType: "รถตู้", capacity: "10", brand: "Toyota", model: "Commuter", colour: "ขาว", icon: "vip" };

describe("updateVehicleAction", () => {
  beforeEach(() => {
    writes.length = 0;
    requirePermission.mockClear();
    row = { id: ID, project_id: PROJECT, metadata: { icon: "van", packageAmount: 3000, operationNote: "keep me", brand: "Toyota", model: "Commuter", colour: "ขาว" } };
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

describe("updateVehicleAction — quick edit from the resource list", () => {
  beforeEach(() => {
    writes.length = 0;
    row = { id: ID, project_id: PROJECT, metadata: { icon: "van", packageHours: 10, packageAmount: 3000, brand: "Toyota", model: "Commuter", colour: "ขาว" } };
  });

  it("changes the plate and the package without blanking the fields it did not send", async () => {
    await updateVehicleAction({ id: ID, plateNumber: "1กข 9999", vehicleType: "รถตู้", capacity: 10, packageHours: 12, packageAmount: 3600 });
    expect(writes[0].patch.metadata).toMatchObject({ brand: "Toyota", model: "Commuter", colour: "ขาว", icon: "van", packageHours: 12, packageAmount: 3600 });
  });
});

describe("updateDriverAction", () => {
  beforeEach(() => {
    writes.length = 0;
    requirePermission.mockClear();
    row = { id: ID, project_id: PROJECT, metadata: { nickname: "ใจ" } };
  });

  it("fixes a typo in place, checked against the driver's own project", async () => {
    const result = await updateDriverAction({ id: ID, fullName: "สมใจ ชายดี", phone: "0895554478", licenseType: "ท.2" });
    expect(result.success).toBe(true);
    expect(requirePermission).toHaveBeenCalledWith(PROJECT, "driver.create");
    expect(writes[0]).toEqual({ id: ID, patch: { full_name: "สมใจ ชายดี", phone: "0895554478", license_type: "ท.2", metadata: { nickname: "ใจ" } } });
  });

  it("updates every detail sent and keeps the ones it was not sent", async () => {
    row = { id: ID, project_id: PROJECT, metadata: { nickname: "ใจ", licenseNumber: "123", note: "keep" } };
    await updateDriverAction({ id: ID, fullName: "สมใจ ชายดี", phone: "0895554478", languages: ["ไทย", "อังกฤษ"], licenseNumber: "999", emergencyContactPhone: "0811111111" });
    expect(writes[0].patch).toMatchObject({
      languages: ["ไทย", "อังกฤษ"],
      metadata: { nickname: "ใจ", note: "keep", licenseNumber: "999", emergencyContactPhone: "0811111111" }
    });
  });

  it("refuses an empty name", async () => {
    const result = await updateDriverAction({ id: ID, fullName: "", phone: "0895554478" });
    expect(result.success).toBe(false);
    expect(writes).toHaveLength(0);
  });
});
