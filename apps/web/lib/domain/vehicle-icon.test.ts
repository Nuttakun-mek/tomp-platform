import { describe, expect, it } from "vitest";
import { inferVehicleIcon, normaliseVehicleIcon, vehicleIconShortLabel, vehicleIconSvgMarkup } from "./vehicle-icon";

describe("vehicle icon helpers", () => {
  it("accepts only known explicit vehicle icons", () => {
    expect(normaliseVehicleIcon("van")).toBe("van");
    expect(normaliseVehicleIcon("unknown")).toBeNull();
    expect(normaliseVehicleIcon(null)).toBeNull();
  });

  it("prefers explicit icon from vehicle metadata", () => {
    expect(inferVehicleIcon({ icon: "pickup", vehicleType: "van", capacity: 12 })).toBe("pickup");
  });

  it("infers icon from vehicle type before capacity fallback", () => {
    expect(inferVehicleIcon({ vehicleType: "airport van", capacity: 4 })).toBe("van");
    expect(inferVehicleIcon({ vehicleType: "bus", capacity: 4 })).toBe("bus");
    expect(inferVehicleIcon({ vehicleType: "motorbike", capacity: 1 })).toBe("motorcycle");
  });

  it("falls back to capacity when vehicle type is not specific", () => {
    expect(inferVehicleIcon({ capacity: 40 })).toBe("bus");
    expect(inferVehicleIcon({ capacity: 14 })).toBe("minibus");
    expect(inferVehicleIcon({ capacity: 8 })).toBe("van");
    expect(inferVehicleIcon({ capacity: 2 })).toBe("motorcycle");
    expect(inferVehicleIcon({ capacity: 4 })).toBe("sedan");
  });

  it("returns compact labels for map markers", () => {
    expect(vehicleIconShortLabel("suv")).toBe("SUV");
    expect(vehicleIconShortLabel("motorcycle")).toBe("MC");
  });

  it("returns svg markup for visual map markers", () => {
    expect(vehicleIconSvgMarkup("van")).toContain("<svg");
    expect(vehicleIconSvgMarkup("van")).toContain("tomp-map-marker-icon");
    expect(vehicleIconSvgMarkup("van")).not.toContain(">ตู้<");
  });
});
