// Picks the flight a spreadsheet row means from what the flight API returned.
// Pure, so it can be tested without the network; the caller does the lookup.

export interface FlightOption {
  flightNumber: string;
  originAirport: string | null;
  destinationAirport: string | null;
  scheduledDepartureAt: string | null;
  scheduledDepartureLocal: string | null;
  scheduledArrivalAt: string | null;
  scheduledArrivalLocal: string | null;
  status: string | null;
}

// Airports a transfer in Thailand starts or ends at. An arrival lands at one of
// these; a departure leaves from one. Used to pick the right leg when a flight
// number has several (e.g. a multi-stop route).
export const THAI_AIRPORTS = new Set(["BKK", "DMK", "HKT", "CNX", "USM", "KBV", "CEI", "HDY", "UTH", "URT", "UTP", "KKC", "NST", "TST", "UBP", "NAW", "PHS", "LPT", "CJM"]);

export type FlightMatch =
  | { status: "verified"; flight: FlightOption }
  | { status: "multiple_matches"; options: FlightOption[] }
  | { status: "route_mismatch"; options: FlightOption[] }
  | { status: "not_found" }
  | { status: "unchecked"; reason: "not_configured" | "provider_error" | "invalid_input" };

export function chooseFlight(direction: "arrival" | "departure", date: string, options: FlightOption[]): FlightMatch {
  const onDate = options.filter(
    (option) => option.scheduledDepartureLocal?.slice(0, 10) === date || option.scheduledArrivalLocal?.slice(0, 10) === date
  );
  if (!onDate.length) return { status: "not_found" };
  const thaiEnd = onDate.filter((option) =>
    direction === "arrival" ? THAI_AIRPORTS.has(option.destinationAirport ?? "") : THAI_AIRPORTS.has(option.originAirport ?? "")
  );
  if (!thaiEnd.length) return { status: "route_mismatch", options: onDate };
  // Same leg listed more than once (codeshare rows) is still one flight.
  const unique = [...new Map(thaiEnd.map((option) => [`${option.originAirport}-${option.destinationAirport}-${option.scheduledDepartureAt}`, option])).values()];
  return unique.length === 1 ? { status: "verified", flight: unique[0] } : { status: "multiple_matches", options: unique };
}

/** Pickup time the case form would suggest: 45 min after landing, or 3 h before take-off. */
export function suggestedPickupAt(direction: "arrival" | "departure", flight: Pick<FlightOption, "scheduledArrivalAt" | "scheduledDepartureAt">): string | null {
  const base = direction === "arrival" ? flight.scheduledArrivalAt : flight.scheduledDepartureAt;
  if (!base) return null;
  const at = new Date(base).getTime();
  if (!Number.isFinite(at)) return null;
  return new Date(at + (direction === "arrival" ? 45 : -180) * 60_000).toISOString();
}
