import "server-only";

import { getSupabaseServerDataClient } from "@/lib/supabase/server";
import type { AirportTransferCase, AirportTransferSummary, AirportTransferTask } from "./types";

type CaseRow = Record<string, unknown>;

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length ? value : null;
}

function mapCase(row: CaseRow): AirportTransferCase {
  const fullName = [row.passenger_title, row.passenger_first_name, row.passenger_last_name]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ");

  return {
    id: String(row.id),
    caseCode: String(row.case_code),
    direction: row.direction === "departure" ? "departure" : "arrival",
    clientName: asNullableString(row.client_name),
    passengerName: fullName,
    passengerMobile: asNullableString(row.passenger_mobile),
    passengerCount: Number(row.passenger_count || 1),
    luggageCount: Number(row.luggage_count || 0),
    travelDate: String(row.travel_date),
    flightNumber: String(row.flight_number),
    originAirport: asNullableString(row.origin_airport),
    destinationAirport: asNullableString(row.destination_airport),
    scheduledDepartureAt: asNullableString(row.scheduled_departure_at),
    scheduledArrivalAt: asNullableString(row.scheduled_arrival_at),
    pickupName: String(row.pickup_name),
    dropoffName: String(row.dropoff_name),
    recommendedPickupAt: asNullableString(row.recommended_pickup_at),
    confirmedPickupAt: asNullableString(row.confirmed_pickup_at),
    vehicleType: asNullableString(row.vehicle_type),
    vehiclePlate: asNullableString(row.vehicle_plate_snapshot),
    driverName: asNullableString(row.driver_name_snapshot),
    driverPhone: asNullableString(row.driver_phone_snapshot),
    verificationStatus: row.flight_verification_status as AirportTransferCase["verificationStatus"],
    operationalStatus: row.operational_status as AirportTransferCase["operationalStatus"],
    nextActionAt: asNullableString(row.next_action_at),
    createdAt: String(row.created_at)
  };
}

export async function getAirportTransferCases(filters?: { direction?: string; status?: string; query?: string }): Promise<AirportTransferCase[]> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return [];

  let query = supabase.from("airport_transfer_cases").select("*").order("next_action_at", { ascending: true, nullsFirst: false }).limit(200);
  if (filters?.direction === "arrival" || filters?.direction === "departure") query = query.eq("direction", filters.direction);
  if (filters?.status) query = query.eq("operational_status", filters.status);
  if (filters?.query?.trim()) {
    const term = filters.query.trim().replaceAll(",", "");
    query = query.or(`case_code.ilike.%${term}%,flight_number.ilike.%${term}%,passenger_first_name.ilike.%${term}%,passenger_last_name.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row) => mapCase(row as CaseRow));
}

export async function getAirportTransferCase(caseId: string): Promise<AirportTransferCase | null> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("airport_transfer_cases").select("*").eq("id", caseId).maybeSingle();
  if (error || !data) return null;
  return mapCase(data as CaseRow);
}

export async function getAirportTransferTasks(caseId: string): Promise<AirportTransferTask[]> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("airport_transfer_tasks")
    .select("id, task_key, label, owner_role, sequence, status, completed_at, note")
    .eq("case_id", caseId)
    .order("sequence", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    taskKey: String(row.task_key),
    label: String(row.label),
    ownerRole: String(row.owner_role),
    sequence: Number(row.sequence || 0),
    status: row.status as AirportTransferTask["status"],
    completedAt: asNullableString(row.completed_at),
    note: asNullableString(row.note)
  }));
}

export function summarizeAirportTransferCases(cases: AirportTransferCase[]): AirportTransferSummary {
  const verificationProblems = new Set(["route_mismatch", "date_mismatch", "not_found", "provider_unavailable", "needs_recheck"]);
  return {
    total: cases.length,
    actionRequired: cases.filter((item) => !["completed", "cancelled"].includes(item.operationalStatus)).length,
    unassigned: cases.filter((item) => !item.driverName || !item.vehiclePlate).length,
    verificationIssues: cases.filter((item) => verificationProblems.has(item.verificationStatus)).length,
    completed: cases.filter((item) => item.operationalStatus === "completed").length
  };
}
