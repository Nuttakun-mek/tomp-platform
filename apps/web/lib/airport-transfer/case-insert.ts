import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FLIGHT_PROVIDER } from "./flight-provider";

// Writing one Airport Transfer case and everything that comes with it (its
// task checklist, the first status event, the audit entry, flight snapshots).
// Shared by the case form (app/airport-transfer/actions.ts) and the Excel
// import, so a case looks the same whichever way it arrived.

export function airportTransferTaskTemplate(direction: "arrival" | "departure") {
  const shared = [
    ["flight_verified", "ตรวจสอบเที่ยวบินแล้ว", "airport_dispatcher"],
    ["vehicle_assigned", "จัดรถและคนขับแล้ว", "airport_dispatcher"],
    ["driver_notified", "แจ้งงานคนขับแล้ว", "airport_dispatcher"],
    ["driver_confirmed", "คนขับรับทราบแล้ว", "airport_driver"]
  ];
  const arrival = [
    ["vehicle_at_airport", "รถถึงจุดรอสนามบิน", "airport_driver"],
    ["flight_landed", "เครื่องบินลงจอดแล้ว", "airport_coordinator"],
    ["passenger_met", "พบผู้โดยสารแล้ว", "airport_coordinator"],
    ["passenger_on_board", "ผู้โดยสารขึ้นรถแล้ว", "airport_driver"],
    ["destination_arrived", "ถึงที่พักแล้ว", "airport_driver"]
  ];
  const departure = [
    ["vehicle_en_route", "รถออกเดินทางไปรับ", "airport_driver"],
    ["vehicle_at_pickup", "รถถึงจุดรับแล้ว", "airport_driver"],
    ["passenger_on_board", "รับผู้โดยสารแล้ว", "airport_driver"],
    ["airport_arrived", "ถึงสนามบินแล้ว", "airport_driver"],
    ["passenger_handed_over", "ส่งมอบผู้โดยสารแล้ว", "airport_coordinator"]
  ];
  return [...shared, ...(direction === "arrival" ? arrival : departure), ["completed", "ปิดงาน", "airport_dispatcher"]] as Array<[string, string, string]>;
}

export interface FlightSnapshotInput {
  scheduledDepartureAt: string | null;
  estimatedDepartureAt?: string | null;
  actualDepartureAt?: string | null;
  scheduledArrivalAt: string | null;
  estimatedArrivalAt?: string | null;
  actualArrivalAt?: string | null;
  status: string | null;
  raw: unknown;
}

export interface NewAirportTransferCase {
  projectId: string;
  organizationId: string | null;
  createdBy: string;
  direction: "arrival" | "departure";
  clientName: string | null;
  passengerTitle: string | null;
  passengerFirstName: string;
  passengerLastName: string;
  passengerEmail: string | null;
  passengerMobile: string | null;
  passengerCount: number;
  luggageCount: number;
  travelDate: string;
  flightNumber: string;
  originAirport: string | null;
  destinationAirport: string | null;
  departureAt: string | null;
  arrivalAt: string | null;
  pickupName: string;
  pickupAddress: string | null;
  pickupMapsUrl: string | null;
  dropoffName: string;
  dropoffAddress: string | null;
  dropoffMapsUrl: string | null;
  recommendedPickupAt: string | null;
  confirmedPickupAt: string | null;
  pickupTimeOverrideReason: string | null;
  vehicleType: string | null;
  /** A Ground Transfer vehicle and driver of the same project, when a unit was chosen. */
  vehicleId?: string | null;
  driverId?: string | null;
  vehiclePlate: string | null;
  driverName: string | null;
  driverPhone: string | null;
  fastTrack: boolean;
  notes: string | null;
  verificationStatus: string;
  /** False when the flight API was not configured — no provider is recorded then. */
  providerConsulted: boolean;
  providerCheckedAt: string | null;
  snapshots: FlightSnapshotInput[];
  /** How the case arrived, for the audit trail (e.g. { importBatchId, rowNumber }). */
  source?: Record<string, unknown>;
  /** Overrides the status the flight check would give (e.g. "assigned" when a unit is set). */
  operationalStatus?: string;
}

export async function insertAirportTransferCase(
  supabase: SupabaseClient,
  input: NewAirportTransferCase
): Promise<{ ok: true; caseId: string; caseCode: string } | { ok: false; message: string }> {
  const caseId = randomUUID();
  const caseCode = `APT-${input.travelDate.replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const status = input.operationalStatus ?? (input.verificationStatus === "verified" ? "verified" : "needs_review");
  const pickupAt = input.confirmedPickupAt || input.recommendedPickupAt;

  const { error: caseError } = await supabase.from("airport_transfer_cases").insert({
    id: caseId,
    organization_id: input.organizationId,
    project_id: input.projectId,
    case_code: caseCode,
    direction: input.direction,
    client_name: input.clientName,
    passenger_title: input.passengerTitle,
    passenger_first_name: input.passengerFirstName,
    passenger_last_name: input.passengerLastName,
    passenger_email: input.passengerEmail,
    passenger_mobile: input.passengerMobile,
    passenger_count: input.passengerCount,
    luggage_count: input.luggageCount,
    travel_date: input.travelDate,
    flight_number: input.flightNumber,
    origin_airport: input.originAirport,
    destination_airport: input.destinationAirport,
    scheduled_departure_at: input.departureAt,
    scheduled_arrival_at: input.arrivalAt,
    pickup_name: input.pickupName,
    pickup_address: input.pickupAddress,
    pickup_maps_url: input.pickupMapsUrl,
    dropoff_name: input.dropoffName,
    dropoff_address: input.dropoffAddress,
    dropoff_maps_url: input.dropoffMapsUrl,
    recommended_pickup_at: input.recommendedPickupAt,
    confirmed_pickup_at: pickupAt,
    pickup_time_override_reason: input.pickupTimeOverrideReason,
    vehicle_type: input.vehicleType,
    vehicle_id: input.vehicleId ?? null,
    driver_id: input.driverId ?? null,
    vehicle_plate_snapshot: input.vehiclePlate,
    driver_name_snapshot: input.driverName,
    driver_phone_snapshot: input.driverPhone,
    fast_track: input.fastTrack,
    notes: input.notes,
    flight_verification_status: input.verificationStatus,
    flight_provider: input.providerConsulted ? FLIGHT_PROVIDER : null,
    flight_provider_checked_at: input.providerCheckedAt,
    operational_status: status,
    next_action_at: pickupAt,
    created_by: input.createdBy,
    metadata: input.source ? { source: input.source } : {}
  });
  if (caseError) return { ok: false, message: caseError.message };

  const tasks = airportTransferTaskTemplate(input.direction).map(([taskKey, label, ownerRole], sequence) => ({
    case_id: caseId,
    task_key: taskKey,
    label,
    owner_role: ownerRole,
    sequence: sequence + 1
  }));

  await Promise.all([
    supabase.from("airport_transfer_tasks").insert(tasks),
    supabase.from("airport_transfer_status_events").insert({ case_id: caseId, to_status: status, event_type: "case_created", actor_profile_id: input.createdBy }),
    supabase.from("airport_transfer_audit_logs").insert({
      case_id: caseId,
      entity_type: "transfer_case",
      entity_id: caseId,
      action: "created",
      new_value: { caseCode, direction: input.direction, flightNumber: input.flightNumber, ...(input.source ? { source: input.source } : {}) },
      actor_profile_id: input.createdBy
    }),
    input.snapshots.length
      ? supabase.from("airport_transfer_flight_snapshots").insert(
          input.snapshots.map((snapshot) => ({
            case_id: caseId,
            provider: FLIGHT_PROVIDER,
            verification_status: input.verificationStatus,
            scheduled_departure_at: snapshot.scheduledDepartureAt,
            estimated_departure_at: snapshot.estimatedDepartureAt ?? null,
            actual_departure_at: snapshot.actualDepartureAt ?? null,
            scheduled_arrival_at: snapshot.scheduledArrivalAt,
            estimated_arrival_at: snapshot.estimatedArrivalAt ?? null,
            actual_arrival_at: snapshot.actualArrivalAt ?? null,
            provider_status: snapshot.status,
            confidence: "confirmed",
            raw_payload: snapshot.raw
          }))
        )
      : Promise.resolve()
  ]);

  return { ok: true, caseId, caseCode };
}
