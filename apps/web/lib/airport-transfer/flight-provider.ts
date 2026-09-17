import "server-only";

import { readCleanEnv } from "@/lib/env";

export interface FlightVerificationCandidate {
  flightNumber: string;
  originAirport: string | null;
  originAirportName: string | null;
  destinationAirport: string | null;
  destinationAirportName: string | null;
  scheduledDepartureAt: string | null;
  scheduledDepartureLocal: string | null;
  scheduledArrivalAt: string | null;
  scheduledArrivalLocal: string | null;
  status: string | null;
  raw: unknown;
}

export type FlightVerificationResult =
  | { ok: true; provider: "aerodatabox"; candidates: FlightVerificationCandidate[] }
  | { ok: false; provider: "aerodatabox"; reason: "not_configured" | "not_found" | "provider_error"; detail?: string };

function nestedString(value: unknown, ...path: string[]): string | null {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : null;
}

export async function verifyFlightByNumberAndDate(flightNumber: string, dateLocal: string): Promise<FlightVerificationResult> {
  const apiKey = readCleanEnv("AERODATABOX_API_KEY");
  if (!apiKey) return { ok: false, provider: "aerodatabox", reason: "not_configured" };

  const normalized = flightNumber.replace(/\s+/g, "").toUpperCase();
  const endpoint = `https://api.aerodatabox.com/flights/number/${encodeURIComponent(normalized)}/${encodeURIComponent(dateLocal)}`;

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json", "X-Api-Key": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000)
    });
    if (response.status === 204 || response.status === 404) return { ok: false, provider: "aerodatabox", reason: "not_found" };
    if (!response.ok) return { ok: false, provider: "aerodatabox", reason: "provider_error", detail: `HTTP ${response.status}` };

    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || !payload.length) return { ok: false, provider: "aerodatabox", reason: "not_found" };
    return {
      ok: true,
      provider: "aerodatabox",
      candidates: payload.map((flight) => ({
        flightNumber: nestedString(flight, "number") || normalized,
        originAirport: nestedString(flight, "departure", "airport", "iata"),
        originAirportName: nestedString(flight, "departure", "airport", "name"),
        destinationAirport: nestedString(flight, "arrival", "airport", "iata"),
        destinationAirportName: nestedString(flight, "arrival", "airport", "name"),
        scheduledDepartureAt: nestedString(flight, "departure", "scheduledTime", "utc"),
        scheduledDepartureLocal: nestedString(flight, "departure", "scheduledTime", "local"),
        scheduledArrivalAt: nestedString(flight, "arrival", "scheduledTime", "utc"),
        scheduledArrivalLocal: nestedString(flight, "arrival", "scheduledTime", "local"),
        status: nestedString(flight, "status"),
        raw: flight
      }))
    };
  } catch (error) {
    return { ok: false, provider: "aerodatabox", reason: "provider_error", detail: error instanceof Error ? error.message : "unknown error" };
  }
}
