"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAirportTransferAccess } from "@/lib/airport-transfer/access";
import { verifyFlightByNumberAndDate } from "@/lib/airport-transfer/flight-provider";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";
import type { AirportTransferOperationalStatus } from "@/lib/airport-transfer/types";

export interface CreateTransferCaseState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export interface FlightLookupCandidate {
  flightNumber: string;
  originAirport: string;
  originAirportName: string | null;
  destinationAirport: string;
  destinationAirportName: string | null;
  scheduledDepartureLocal: string;
  scheduledDepartureAt: string | null;
  scheduledArrivalLocal: string;
  scheduledArrivalAt: string | null;
  status: string | null;
}

export type FlightLookupState =
  | { ok: true; message: string; candidates: FlightLookupCandidate[] }
  | { ok: false; message: string; reason: "invalid_input" | "not_configured" | "not_found" | "provider_error" };

const optionalText = z.string().trim().transform((value) => value || null);
const createCaseSchema = z.object({
  direction: z.enum(["arrival", "departure"]),
  clientName: optionalText,
  passengerTitle: optionalText,
  passengerFirstName: z.string().trim().min(1, "กรุณากรอกชื่อผู้โดยสาร"),
  passengerLastName: z.string().trim().min(1, "กรุณากรอกนามสกุลผู้โดยสาร"),
  passengerEmail: z.union([z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง"), z.literal("")]).transform((value) => value || null),
  passengerMobile: optionalText,
  passengerCount: z.coerce.number().int().min(1).max(99),
  luggageCount: z.coerce.number().int().min(0).max(999),
  travelDate: z.string().date("กรุณาระบุวันเดินทาง"),
  flightNumber: z.string().trim().min(2, "กรุณากรอกหมายเลขเที่ยวบิน").max(10).transform((value) => value.replace(/\s+/g, "").toUpperCase()),
  originAirport: optionalText.transform((value) => value?.toUpperCase() || null),
  destinationAirport: optionalText.transform((value) => value?.toUpperCase() || null),
  scheduledDepartureLocal: optionalText,
  scheduledDepartureUtc: optionalText,
  scheduledArrivalLocal: optionalText,
  scheduledArrivalUtc: optionalText,
  pickupName: z.string().trim().min(1, "กรุณาระบุจุดรับ"),
  pickupAddress: optionalText,
  pickupMapsUrl: optionalText,
  dropoffName: z.string().trim().min(1, "กรุณาระบุจุดส่ง"),
  dropoffAddress: optionalText,
  dropoffMapsUrl: optionalText,
  confirmedPickupLocal: optionalText,
  pickupTimeOverrideReason: optionalText,
  vehicleType: optionalText,
  vehiclePlate: optionalText,
  driverName: optionalText,
  driverPhone: optionalText,
  notes: optionalText,
  fastTrack: z.boolean()
});

function thailandTimeToIso(value: string | null): string | null {
  if (!value) return null;
  const hasOffset = /(?:Z|[+-]\d\d:\d\d)$/.test(value);
  const parsed = new Date(hasOffset ? value : `${value}:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function recommendedPickup(direction: "arrival" | "departure", departureAt: string | null, arrivalAt: string | null): string | null {
  const base = direction === "departure" ? departureAt : arrivalAt;
  if (!base) return null;
  const timestamp = new Date(base).getTime();
  const adjustment = direction === "departure" ? -3 * 60 * 60 * 1000 : 45 * 60 * 1000;
  return new Date(timestamp + adjustment).toISOString();
}

function taskTemplate(direction: "arrival" | "departure") {
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

export async function lookupAirportTransferFlight(input: {
  travelDate: string;
  flightNumber: string;
}): Promise<FlightLookupState> {
  const access = await getAirportTransferAccess();
  if (!access.allowed || !access.canManage) {
    return { ok: false, message: "บัญชีนี้ไม่มีสิทธิ์ตรวจสอบเที่ยวบิน", reason: "invalid_input" };
  }

  const parsed = z.object({
    travelDate: z.string().date(),
    flightNumber: z.string().trim().min(2).max(10).transform((value) => value.replace(/\s+/g, "").toUpperCase())
  }).safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "กรุณาระบุวันเดินทางและหมายเลขเที่ยวบินให้ครบถ้วน", reason: "invalid_input" };
  }

  const verification = await verifyFlightByNumberAndDate(parsed.data.flightNumber, parsed.data.travelDate);
  if (!verification.ok) {
    const messages = {
      not_configured: "ยังไม่ได้ตั้งค่า Flight API กรุณาติดต่อผู้ดูแลระบบ",
      not_found: "ไม่พบเที่ยวบินนี้ในวันที่ระบุ กรุณาตรวจสอบวันเดินทางและหมายเลขเที่ยวบิน",
      provider_error: "ผู้ให้บริการข้อมูลเที่ยวบินไม่ตอบสนอง กรุณาลองใหม่อีกครั้ง"
    } as const;
    return { ok: false, message: messages[verification.reason], reason: verification.reason };
  }

  const candidates = verification.candidates.flatMap((candidate) => {
    if (!candidate.originAirport || !candidate.destinationAirport || !candidate.scheduledDepartureLocal || !candidate.scheduledArrivalLocal) return [];
    return [{
      flightNumber: candidate.flightNumber,
      originAirport: candidate.originAirport,
      originAirportName: candidate.originAirportName,
      destinationAirport: candidate.destinationAirport,
      destinationAirportName: candidate.destinationAirportName,
      scheduledDepartureLocal: candidate.scheduledDepartureLocal,
      scheduledDepartureAt: candidate.scheduledDepartureAt,
      scheduledArrivalLocal: candidate.scheduledArrivalLocal,
      scheduledArrivalAt: candidate.scheduledArrivalAt,
      status: candidate.status
    }];
  });

  if (!candidates.length) {
    return { ok: false, message: "พบเที่ยวบิน แต่ข้อมูลสนามบินหรือเวลาไม่ครบถ้วน กรุณาตรวจสอบด้วยตนเอง", reason: "provider_error" };
  }

  return {
    ok: true,
    message: candidates.length === 1 ? "ตรวจสอบเที่ยวบินสำเร็จ" : `พบข้อมูลเที่ยวบิน ${candidates.length} รายการ กรุณาเลือกรายการที่ถูกต้อง`,
    candidates
  };
}

export async function createAirportTransferCase(_previous: CreateTransferCaseState, formData: FormData): Promise<CreateTransferCaseState> {
  const access = await getAirportTransferAccess();
  if (!access.allowed || !access.canManage) return { ok: false, message: "บัญชีนี้ไม่มีสิทธิ์สร้างเคส Airport Transfer" };

  const parsed = createCaseSchema.safeParse({
    direction: formData.get("direction"),
    clientName: formData.get("clientName") || "",
    passengerTitle: formData.get("passengerTitle") || "",
    passengerFirstName: formData.get("passengerFirstName"),
    passengerLastName: formData.get("passengerLastName"),
    passengerEmail: formData.get("passengerEmail") || "",
    passengerMobile: formData.get("passengerMobile") || "",
    passengerCount: formData.get("passengerCount") || 1,
    luggageCount: formData.get("luggageCount") || 0,
    travelDate: formData.get("travelDate"),
    flightNumber: formData.get("flightNumber"),
    originAirport: formData.get("originAirport") || "",
    destinationAirport: formData.get("destinationAirport") || "",
    scheduledDepartureLocal: formData.get("scheduledDepartureLocal") || "",
    scheduledDepartureUtc: formData.get("scheduledDepartureUtc") || "",
    scheduledArrivalLocal: formData.get("scheduledArrivalLocal") || "",
    scheduledArrivalUtc: formData.get("scheduledArrivalUtc") || "",
    pickupName: formData.get("pickupName"),
    pickupAddress: formData.get("pickupAddress") || "",
    pickupMapsUrl: formData.get("pickupMapsUrl") || "",
    dropoffName: formData.get("dropoffName"),
    dropoffAddress: formData.get("dropoffAddress") || "",
    dropoffMapsUrl: formData.get("dropoffMapsUrl") || "",
    confirmedPickupLocal: formData.get("confirmedPickupLocal") || "",
    pickupTimeOverrideReason: formData.get("pickupTimeOverrideReason") || "",
    vehicleType: formData.get("vehicleType") || "",
    vehiclePlate: formData.get("vehiclePlate") || "",
    driverName: formData.get("driverName") || "",
    driverPhone: formData.get("driverPhone") || "",
    notes: formData.get("notes") || "",
    fastTrack: formData.get("fastTrack") === "on"
  });

  if (!parsed.success) {
    return { ok: false, message: "กรุณาตรวจสอบข้อมูลที่จำเป็น", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = getSupabaseServerDataClient();
  if (!supabase) return { ok: false, message: "ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase" };

  const input = parsed.data;
  const profile = await getCurrentUserProfile();
  const departureAt = input.scheduledDepartureUtc || thailandTimeToIso(input.scheduledDepartureLocal);
  const arrivalAt = input.scheduledArrivalUtc || thailandTimeToIso(input.scheduledArrivalLocal);
  const suggestedPickup = recommendedPickup(input.direction, departureAt, arrivalAt);
  const confirmedPickup = thailandTimeToIso(input.confirmedPickupLocal);
  const caseId = randomUUID();
  const caseCode = `APT-${input.travelDate.replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;

  const verification = await verifyFlightByNumberAndDate(input.flightNumber, input.travelDate);
  let verificationStatus = "pending";
  let providerCheckedAt: string | null = null;
  if (!verification.ok) {
    if (verification.reason === "not_found") verificationStatus = "not_found";
    if (verification.reason === "provider_error") verificationStatus = "provider_unavailable";
  } else {
    providerCheckedAt = new Date().toISOString();
    const matching = verification.candidates.filter((candidate) => {
      const originMatches = !input.originAirport || candidate.originAirport === input.originAirport;
      const destinationMatches = !input.destinationAirport || candidate.destinationAirport === input.destinationAirport;
      return originMatches && destinationMatches;
    });
    verificationStatus = matching.length === 1 ? "verified" : matching.length > 1 ? "multiple_matches" : "route_mismatch";
  }

  const { error: caseError } = await supabase.from("airport_transfer_cases").insert({
    id: caseId,
    organization_id: profile.organizationId,
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
    scheduled_departure_at: departureAt,
    scheduled_arrival_at: arrivalAt,
    pickup_name: input.pickupName,
    pickup_address: input.pickupAddress,
    pickup_maps_url: input.pickupMapsUrl,
    dropoff_name: input.dropoffName,
    dropoff_address: input.dropoffAddress,
    dropoff_maps_url: input.dropoffMapsUrl,
    recommended_pickup_at: suggestedPickup,
    confirmed_pickup_at: confirmedPickup || suggestedPickup,
    pickup_time_override_reason: input.pickupTimeOverrideReason,
    vehicle_type: input.vehicleType,
    vehicle_plate_snapshot: input.vehiclePlate,
    driver_name_snapshot: input.driverName,
    driver_phone_snapshot: input.driverPhone,
    fast_track: input.fastTrack,
    notes: input.notes,
    flight_verification_status: verificationStatus,
    flight_provider: verification.ok || verification.reason !== "not_configured" ? "aerodatabox" : null,
    flight_provider_checked_at: providerCheckedAt,
    operational_status: verificationStatus === "verified" ? "verified" : "needs_review",
    next_action_at: confirmedPickup || suggestedPickup,
    created_by: profile.id
  });

  if (caseError) return { ok: false, message: `บันทึกเคสไม่สำเร็จ: ${caseError.message}` };

  const tasks = taskTemplate(input.direction).map(([taskKey, label, ownerRole], sequence) => ({
    case_id: caseId,
    task_key: taskKey,
    label,
    owner_role: ownerRole,
    sequence: sequence + 1
  }));

  await Promise.all([
    supabase.from("airport_transfer_tasks").insert(tasks),
    supabase.from("airport_transfer_status_events").insert({ case_id: caseId, to_status: verificationStatus === "verified" ? "verified" : "needs_review", event_type: "case_created", actor_profile_id: profile.id }),
    supabase.from("airport_transfer_audit_logs").insert({ case_id: caseId, entity_type: "transfer_case", entity_id: caseId, action: "created", new_value: { caseCode, direction: input.direction, flightNumber: input.flightNumber }, actor_profile_id: profile.id }),
    verification.ok
      ? supabase.from("airport_transfer_flight_snapshots").insert(
          verification.candidates.map((candidate) => ({
            case_id: caseId,
            provider: "aerodatabox",
            verification_status: verificationStatus,
            scheduled_departure_at: candidate.scheduledDepartureAt,
            scheduled_arrival_at: candidate.scheduledArrivalAt,
            provider_status: candidate.status,
            confidence: "confirmed",
            raw_payload: candidate.raw
          }))
        )
      : Promise.resolve()
  ]);

  revalidatePath("/airport-transfer");
  revalidatePath("/airport-transfer/cases");
  redirect(`/airport-transfer/cases?created=${encodeURIComponent(caseCode)}`);
}

const taskStatusMap: Record<string, AirportTransferOperationalStatus | undefined> = {
  flight_verified: "verified",
  vehicle_assigned: "assigned",
  driver_notified: "driver_notified",
  driver_confirmed: "driver_confirmed",
  vehicle_en_route: "vehicle_en_route",
  vehicle_at_airport: "vehicle_arrived",
  vehicle_at_pickup: "vehicle_arrived",
  passenger_met: "passenger_met",
  passenger_on_board: "passenger_on_board",
  destination_arrived: "arrived_destination",
  airport_arrived: "arrived_destination",
  passenger_handed_over: "arrived_destination",
  completed: "completed"
};

export async function completeAirportTransferTask(caseId: string, taskId: string) {
  const validId = z.string().uuid();
  if (!validId.safeParse(caseId).success || !validId.safeParse(taskId).success) return;

  const access = await getAirportTransferAccess();
  if (!access.allowed || !access.canManage) return;
  const profile = await getCurrentUserProfile();
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return;

  const { data: task } = await supabase
    .from("airport_transfer_tasks")
    .select("id, task_key, status")
    .eq("id", taskId)
    .eq("case_id", caseId)
    .maybeSingle();
  if (!task || task.status === "completed") return;

  const completedAt = new Date().toISOString();
  const { error } = await supabase
    .from("airport_transfer_tasks")
    .update({ status: "completed", completed_at: completedAt, completed_by: profile.id })
    .eq("id", taskId)
    .eq("case_id", caseId)
    .eq("status", "pending");
  if (error) return;

  const nextStatus = taskStatusMap[String(task.task_key)];
  if (nextStatus) {
    const { data: currentCase } = await supabase.from("airport_transfer_cases").select("operational_status").eq("id", caseId).maybeSingle();
    await Promise.all([
      supabase.from("airport_transfer_cases").update({ operational_status: nextStatus }).eq("id", caseId),
      supabase.from("airport_transfer_status_events").insert({
        case_id: caseId,
        from_status: currentCase?.operational_status || null,
        to_status: nextStatus,
        event_type: "task_completed",
        note: String(task.task_key),
        actor_profile_id: profile.id
      })
    ]);
  }

  await supabase.from("airport_transfer_audit_logs").insert({
    case_id: caseId,
    entity_type: "transfer_task",
    entity_id: taskId,
    action: "completed",
    new_value: { taskKey: task.task_key, completedAt },
    actor_profile_id: profile.id
  });
  revalidatePath("/airport-transfer");
  revalidatePath("/airport-transfer/cases");
  revalidatePath(`/airport-transfer/cases/${caseId}`);
}
