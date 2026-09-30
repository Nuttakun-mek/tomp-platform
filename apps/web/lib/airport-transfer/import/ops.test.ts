import { describe, expect, it } from "vitest";
import { effectivePickupAt, opsWarnings, type OpsRowInput, type UnitOption } from "./ops";

const van: UnitOption = { id: "cs1", label: "VAN-01", plate: "1กข 1234", vehicleType: "รถตู้", capacity: 3, driverName: "สมชาย", driverPhone: "081" };
const flight = (arrives: string) => ({
  flightNumber: "TG661",
  originAirport: "NRT",
  destinationAirport: "BKK",
  scheduledDepartureAt: null,
  scheduledDepartureLocal: null,
  scheduledArrivalAt: arrives,
  scheduledArrivalLocal: null,
  status: null
});
const row = (id: string, over: Partial<OpsRowInput> = {}): OpsRowInput => ({ id, direction: "arrival", passengerCount: 2, flight: flight("2026-10-02T08:00:00.000Z"), ops: { callSignId: "cs1" }, ...over });

describe("effectivePickupAt", () => {
  it("uses the time set by hand, else the suggested one", () => {
    expect(effectivePickupAt(row("a"))).toBe("2026-10-02T08:45:00.000Z");
    expect(effectivePickupAt(row("a", { ops: { pickupAt: "2026-10-02T09:30:00.000Z" } }))).toBe("2026-10-02T09:30:00.000Z");
  });
});

describe("opsWarnings", () => {
  it("warns when passengers exceed the unit's seats", () => {
    expect(opsWarnings([row("a", { passengerCount: 5 })], [van]).get("a")?.[0]).toContain("เกินที่นั่ง");
  });

  it("warns both rows when one unit has two pickups under an hour apart", () => {
    const warnings = opsWarnings([row("a"), row("b", { flight: flight("2026-10-02T08:30:00.000Z") })], [van]);
    expect(warnings.get("a")?.[0]).toContain("30 นาที");
    expect(warnings.get("b")?.[0]).toContain("30 นาที");
  });

  it("is quiet for rows with no unit, or far enough apart", () => {
    expect(opsWarnings([row("a", { ops: {} }), row("b", { flight: flight("2026-10-02T12:00:00.000Z") })], [van]).size).toBe(0);
  });
});
