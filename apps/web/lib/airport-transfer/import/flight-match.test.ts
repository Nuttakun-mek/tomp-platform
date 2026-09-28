import { describe, expect, it } from "vitest";
import { chooseFlight, suggestedPickupAt, type FlightOption } from "./flight-match";

const leg = (from: string, to: string, departLocal: string, arriveLocal: string): FlightOption => ({
  flightNumber: "TG661",
  originAirport: from,
  destinationAirport: to,
  scheduledDepartureAt: `${departLocal}:00Z`,
  scheduledDepartureLocal: departLocal,
  scheduledArrivalAt: `${arriveLocal}:00Z`,
  scheduledArrivalLocal: arriveLocal,
  status: "scheduled"
});

describe("chooseFlight", () => {
  it("verifies the one leg that lands in Thailand for an arrival", () => {
    const match = chooseFlight("arrival", "2026-10-02", [leg("NRT", "BKK", "2026-10-02T10:00", "2026-10-02T15:00"), leg("BKK", "CGK", "2026-10-02T17:00", "2026-10-02T20:30")]);
    expect(match.status).toBe("verified");
    expect(match.status === "verified" && match.flight.destinationAirport).toBe("BKK");
  });

  it("says route_mismatch when nothing on that date touches Thailand the right way", () => {
    expect(chooseFlight("departure", "2026-10-02", [leg("NRT", "BKK", "2026-10-02T10:00", "2026-10-02T15:00")]).status).toBe("route_mismatch");
  });

  it("finds nothing on another date", () => {
    expect(chooseFlight("arrival", "2026-10-05", [leg("NRT", "BKK", "2026-10-02T10:00", "2026-10-02T15:00")]).status).toBe("not_found");
  });

  it("counts codeshare duplicates of one leg as one flight", () => {
    const a = leg("NRT", "BKK", "2026-10-02T10:00", "2026-10-02T15:00");
    expect(chooseFlight("arrival", "2026-10-02", [a, { ...a, flightNumber: "NH5953" }]).status).toBe("verified");
  });
});

describe("suggestedPickupAt", () => {
  it("is 45 min after landing, or 3 h before take-off", () => {
    expect(suggestedPickupAt("arrival", { scheduledArrivalAt: "2026-10-02T08:00:00.000Z", scheduledDepartureAt: null })).toBe("2026-10-02T08:45:00.000Z");
    expect(suggestedPickupAt("departure", { scheduledArrivalAt: null, scheduledDepartureAt: "2026-10-02T08:00:00.000Z" })).toBe("2026-10-02T05:00:00.000Z");
  });
});
