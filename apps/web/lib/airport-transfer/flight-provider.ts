import "server-only";

import { readCleanEnv } from "@/lib/env";

export const FLIGHT_PROVIDER = "airlabs" as const;
export const FLIGHT_PROVIDER_API_KEY_ENV = "AIRLABS_API_KEY";

export interface FlightVerificationCandidate {
  flightNumber: string;
  originAirport: string | null;
  originAirportName: string | null;
  destinationAirport: string | null;
  destinationAirportName: string | null;
  scheduledDepartureAt: string | null;
  scheduledDepartureLocal: string | null;
  estimatedDepartureAt: string | null;
  actualDepartureAt: string | null;
  scheduledArrivalAt: string | null;
  scheduledArrivalLocal: string | null;
  estimatedArrivalAt: string | null;
  actualArrivalAt: string | null;
  status: string | null;
  raw: unknown;
}

export type FlightVerificationResult =
  | { ok: true; provider: typeof FLIGHT_PROVIDER; candidates: FlightVerificationCandidate[] }
  | { ok: false; provider: typeof FLIGHT_PROVIDER; reason: "not_configured" | "not_found" | "provider_error"; detail?: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function valueString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function unixIso(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

function utcIso(record: Record<string, unknown>, timestampKey: string, utcKey: string): string | null {
  const timestamp = unixIso(record, timestampKey);
  if (timestamp) return timestamp;
  const value = valueString(record, utcKey);
  if (!value) return null;
  const parsed = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function localDateTime(record: Record<string, unknown>, key: string): string | null {
  const value = valueString(record, key);
  return value ? value.replace(" ", "T").slice(0, 16) : null;
}

function responseRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
  const root = asRecord(payload);
  if (!root) return [];
  const response = root.response;
  if (Array.isArray(response)) return response.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
  const single = asRecord(response);
  return single ? [single] : [];
}

function providerError(payload: unknown): string | null {
  const root = asRecord(payload);
  const error = root ? asRecord(root.error) : null;
  return error ? valueString(error, "message") || valueString(error, "code") : null;
}

function toCandidate(row: Record<string, unknown>, normalized: string): FlightVerificationCandidate {
  return {
    flightNumber: valueString(row, "flight_iata") || valueString(row, "flight_icao") || normalized,
    originAirport: valueString(row, "dep_iata") || valueString(row, "dep_icao"),
    originAirportName: null,
    destinationAirport: valueString(row, "arr_iata") || valueString(row, "arr_icao"),
    destinationAirportName: null,
    scheduledDepartureAt: utcIso(row, "dep_time_ts", "dep_time_utc"),
    scheduledDepartureLocal: localDateTime(row, "dep_time"),
    estimatedDepartureAt: utcIso(row, "dep_estimated_ts", "dep_estimated_utc"),
    actualDepartureAt: utcIso(row, "dep_actual_ts", "dep_actual_utc"),
    scheduledArrivalAt: utcIso(row, "arr_time_ts", "arr_time_utc"),
    scheduledArrivalLocal: localDateTime(row, "arr_time"),
    estimatedArrivalAt: utcIso(row, "arr_estimated_ts", "arr_estimated_utc"),
    actualArrivalAt: utcIso(row, "arr_actual_ts", "arr_actual_utc"),
    status: valueString(row, "status"),
    raw: row
  };
}

function candidateMatchesDate(candidate: FlightVerificationCandidate, dateLocal: string) {
  return candidate.scheduledDepartureLocal?.slice(0, 10) === dateLocal || candidate.scheduledArrivalLocal?.slice(0, 10) === dateLocal;
}

export async function verifyFlightByNumberAndDate(flightNumber: string, dateLocal: string): Promise<FlightVerificationResult> {
  const apiKey = readCleanEnv(FLIGHT_PROVIDER_API_KEY_ENV);
  if (!apiKey) return { ok: false, provider: FLIGHT_PROVIDER, reason: "not_configured" };

  const normalized = flightNumber.replace(/\s+/g, "").toUpperCase();
  const parameters = new URLSearchParams({ flight_iata: normalized, limit: "50", api_key: apiKey });
  const endpoint = `https://airlabs.co/api/v9/schedules?${parameters.toString()}`;

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000)
    });
    if (response.status === 204 || response.status === 404) return { ok: false, provider: FLIGHT_PROVIDER, reason: "not_found" };
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, provider: FLIGHT_PROVIDER, reason: "provider_error", detail: providerError(payload) || `HTTP ${response.status}` };
    const error = providerError(payload);
    if (error) return { ok: false, provider: FLIGHT_PROVIDER, reason: "provider_error", detail: error };

    const candidates = responseRows(payload).map((row) => toCandidate(row, normalized)).filter((candidate) => candidateMatchesDate(candidate, dateLocal));
    if (!candidates.length) return { ok: false, provider: FLIGHT_PROVIDER, reason: "not_found" };
    return { ok: true, provider: FLIGHT_PROVIDER, candidates };
  } catch (error) {
    return { ok: false, provider: FLIGHT_PROVIDER, reason: "provider_error", detail: error instanceof Error ? error.message : "unknown error" };
  }
}
