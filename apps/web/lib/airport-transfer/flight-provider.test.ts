import { describe, expect, it } from "vitest";
import { resolveFlightLookupIdentifier } from "./flight-provider";

describe("resolveFlightLookupIdentifier", () => {
  it("uses the IATA endpoint for two-character airline codes", () => {
    expect(resolveFlightLookupIdentifier("TG 931")).toEqual({ parameter: "flight_iata", value: "TG931" });
  });

  it("uses the ICAO endpoint for three-letter airline codes", () => {
    expect(resolveFlightLookupIdentifier("ELY82")).toEqual({ parameter: "flight_icao", value: "ELY82" });
  });

  it("normalizes the common EL AL name to its IATA code", () => {
    expect(resolveFlightLookupIdentifier("ELAL82")).toEqual({ parameter: "flight_iata", value: "LY82" });
  });

  it("rejects values that are not flight numbers", () => {
    expect(resolveFlightLookupIdentifier("ELAL")).toBeNull();
  });
});
