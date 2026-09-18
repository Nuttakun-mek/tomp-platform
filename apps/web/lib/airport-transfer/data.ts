import "server-only";

import { getSupabaseServerDataClient } from "@/lib/supabase/server";
import { FLIGHT_PROVIDER } from "./flight-provider";
import type { AirportTransferApiHealth, AirportTransferAuditLog, AirportTransferCase, AirportTransferFlightSnapshot, AirportTransferSummary, AirportTransferTask } from "./types";

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
    passengerTitle: asNullableString(row.passenger_title),
    passengerFirstName: String(row.passenger_first_name || ""),
    passengerLastName: String(row.passenger_last_name || ""),
    passengerName: fullName,
    passengerEmail: asNullableString(row.passenger_email),
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
    pickupAddress: asNullableString(row.pickup_address),
    pickupMapsUrl: asNullableString(row.pickup_maps_url),
    dropoffName: String(row.dropoff_name),
    dropoffAddress: asNullableString(row.dropoff_address),
    dropoffMapsUrl: asNullableString(row.dropoff_maps_url),
    recommendedPickupAt: asNullableString(row.recommended_pickup_at),
    confirmedPickupAt: asNullableString(row.confirmed_pickup_at),
    pickupTimeOverrideReason: asNullableString(row.pickup_time_override_reason),
    vehicleType: asNullableString(row.vehicle_type),
    vehiclePlate: asNullableString(row.vehicle_plate_snapshot),
    driverName: asNullableString(row.driver_name_snapshot),
    driverPhone: asNullableString(row.driver_phone_snapshot),
    fastTrack: row.fast_track === true,
    notes: asNullableString(row.notes),
    verificationStatus: row.flight_verification_status as AirportTransferCase["verificationStatus"],
    flightProviderCheckedAt: asNullableString(row.flight_provider_checked_at),
    operationalStatus: row.operational_status as AirportTransferCase["operationalStatus"],
    nextActionAt: asNullableString(row.next_action_at),
    cancelledAt: asNullableString(row.cancelled_at),
    cancellationReason: asNullableString(row.cancellation_reason),
    deletedAt: asNullableString(row.deleted_at),
    deleteReason: asNullableString(row.delete_reason),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export async function getAirportTransferAuditLogs(caseId: string): Promise<AirportTransferAuditLog[]> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("airport_transfer_audit_logs")
    .select("id, action, old_value, new_value, reason, occurred_at, profiles:actor_profile_id(full_name)")
    .eq("case_id", caseId)
    .order("occurred_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data.map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: String(row.id),
      action: String(row.action),
      oldValue: row.old_value && typeof row.old_value === "object" ? row.old_value as Record<string, unknown> : null,
      newValue: row.new_value && typeof row.new_value === "object" ? row.new_value as Record<string, unknown> : null,
      reason: asNullableString(row.reason),
      actorName: profile && typeof profile === "object" ? asNullableString((profile as { full_name?: unknown }).full_name) : null,
      occurredAt: String(row.occurred_at)
    };
  });
}

export async function getLatestAirportTransferFlightSnapshot(caseId: string): Promise<AirportTransferFlightSnapshot | null> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("airport_transfer_flight_snapshots")
    .select("provider_status, observed_at, scheduled_departure_at, estimated_departure_at, actual_departure_at, scheduled_arrival_at, estimated_arrival_at, actual_arrival_at")
    .eq("case_id", caseId)
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    providerStatus: asNullableString(data.provider_status),
    observedAt: String(data.observed_at),
    scheduledDepartureAt: asNullableString(data.scheduled_departure_at),
    estimatedDepartureAt: asNullableString(data.estimated_departure_at),
    actualDepartureAt: asNullableString(data.actual_departure_at),
    scheduledArrivalAt: asNullableString(data.scheduled_arrival_at),
    estimatedArrivalAt: asNullableString(data.estimated_arrival_at),
    actualArrivalAt: asNullableString(data.actual_arrival_at)
  };
}

export async function getAirportTransferCases(filters?: { direction?: string; status?: string; query?: string }): Promise<AirportTransferCase[]> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return [];

  let query = supabase.from("airport_transfer_cases").select("*").is("deleted_at", null).order("next_action_at", { ascending: true, nullsFirst: false }).limit(200);
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

export async function getDeletedAirportTransferCases(): Promise<AirportTransferCase[]> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("airport_transfer_cases").select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(200);
  if (error || !data) return [];
  return data.map((row) => mapCase(row as CaseRow));
}

export async function getAirportTransferApiHealth(): Promise<AirportTransferApiHealth | null> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("airport_transfer_api_health").select("*").eq("provider", FLIGHT_PROVIDER).maybeSingle();
  if (error || !data) return null;
  return {
    provider: String(data.provider),
    connectionStatus: data.connection_status as AirportTransferApiHealth["connectionStatus"],
    pollingEnabled: data.polling_enabled === true,
    pollingIntervalMinutes: Number(data.polling_interval_minutes || 10),
    activeCaseCount: Number(data.active_case_count || 0),
    checkedCaseCount: Number(data.checked_case_count || 0),
    failedCaseCount: Number(data.failed_case_count || 0),
    lastCheckAt: asNullableString(data.last_check_at),
    lastSuccessAt: asNullableString(data.last_success_at),
    lastErrorAt: asNullableString(data.last_error_at),
    lastErrorMessage: asNullableString(data.last_error_message),
    nextCheckAt: asNullableString(data.next_check_at)
  };
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
