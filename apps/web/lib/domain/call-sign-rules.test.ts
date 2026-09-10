import { describe, expect, it } from "vitest";
import { assertAssignmentCrewMatchesCallSign, getMissingCallSignCrewItems, isCallSignCrewed } from "./call-sign-rules";

describe("call sign crewed unit rules", () => {
  it("requires both driver and vehicle before a call sign can open assignments", () => {
    expect(isCallSignCrewed({ driverId: "driver-1", vehicleId: "vehicle-1" })).toBe(true);
    expect(isCallSignCrewed({ driverId: "driver-1", vehicleId: null })).toBe(false);
    expect(getMissingCallSignCrewItems({ driverId: null, vehicleId: "vehicle-1" })).toEqual(["driver"]);
  });

  it("lets assignments inherit from the call sign when no independent crew is supplied", () => {
    expect(
      assertAssignmentCrewMatchesCallSign(
        { driverId: "driver-1", vehicleId: "vehicle-1" },
        { driverId: null, vehicleId: null }
      )
    ).toEqual({ ok: true });
  });

  it("blocks client-supplied crew values that do not match the call sign", () => {
    expect(
      assertAssignmentCrewMatchesCallSign(
        { driverId: "driver-1", vehicleId: "vehicle-1" },
        { driverId: "driver-2", vehicleId: "vehicle-1" }
      )
    ).toEqual({ ok: false, reason: "คนขับของงานไม่ตรงกับ Call Sign ที่เลือก" });

    expect(
      assertAssignmentCrewMatchesCallSign(
        { driverId: "driver-1", vehicleId: "vehicle-1" },
        { driverId: "driver-1", vehicleId: "vehicle-2" }
      )
    ).toEqual({ ok: false, reason: "รถของงานไม่ตรงกับ Call Sign ที่เลือก" });
  });
});
