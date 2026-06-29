import { describe, expect, it } from "vitest";
import { checkDriverReadiness, getDriverReadinessScore, getVehicleReadinessScore } from "../driver-readiness";

describe("driver readiness", () => {
  it("requires all driver readiness confirmations", () => {
    expect(checkDriverReadiness({
      confirmedName: true,
      confirmedPhone: true,
      confirmedVehicle: true,
      vehiclePhotoCaptured: true,
      platePhotoCaptured: true
    })).toBe(true);
  });

  it("calculates driver readiness score", () => {
    expect(getDriverReadinessScore({
      confirmedName: true,
      confirmedPhone: true,
      confirmedVehicle: false,
      vehiclePhotoCaptured: false,
      platePhotoCaptured: false,
      gpsConsent: false
    })).toBe(33);
  });

  it("calculates vehicle readiness score", () => {
    expect(getVehicleReadinessScore({
      vehicleType: "van",
      plateNumber: "DEMO-1",
      capacity: 8,
      outOfService: false,
      photoCaptured: true,
      platePhotoCaptured: false
    })).toBe(83);
  });
});

