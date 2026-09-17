import "server-only";

import { randomUUID } from "crypto";
import { verifyFlightByNumberAndDate } from "./flight-provider";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

type CaseRow = Record<string, unknown>;

export interface FlightSyncRunResult {
  ok: boolean;
  status: "not_configured" | "idle" | "healthy" | "degraded" | "error" | "paused";
  activeCases: number;
  checkedCases: number;
  failedCases: number;
  message: string;
}

function isoDateAtOffset(dayOffset: number) {
  const date = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function recommendedPickup(direction: unknown, departureAt: string | null, arrivalAt: string | null) {
  const base = direction === "departure" ? departureAt : arrivalAt;
  if (!base) return null;
  const adjustment = direction === "departure" ? -3 * 60 * 60 * 1000 : 45 * 60 * 1000;
  return new Date(new Date(base).getTime() + adjustment).toISOString();
}

export async function syncActiveAirportTransferFlights(): Promise<FlightSyncRunResult> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return { ok: false, status: "error", activeCases: 0, checkedCases: 0, failedCases: 0, message: "Supabase ไม่พร้อมใช้งาน" };

  const { data: health } = await supabase.from("airport_transfer_api_health").select("polling_enabled, polling_interval_minutes").eq("provider", "aerodatabox").maybeSingle();
  if (health && health.polling_enabled === false) {
    await supabase.from("airport_transfer_api_health").update({ connection_status: "paused", active_case_count: 0, next_check_at: null }).eq("provider", "aerodatabox");
    return { ok: true, status: "paused", activeCases: 0, checkedCases: 0, failedCases: 0, message: "หยุดการติดตามอัตโนมัติชั่วคราว" };
  }

  const intervalMinutes = Number(health?.polling_interval_minutes || 10);
  const { data: rows, error } = await supabase
    .from("airport_transfer_cases")
    .select("*")
    .is("deleted_at", null)
    .not("operational_status", "in", "(completed,cancelled)")
    .gte("travel_date", isoDateAtOffset(-1))
    .lte("travel_date", isoDateAtOffset(3))
    .order("flight_provider_checked_at", { ascending: true, nullsFirst: true })
    .limit(50);

  if (error) {
    const now = new Date().toISOString();
    await supabase.from("airport_transfer_api_health").update({ connection_status: "error", last_check_at: now, last_error_at: now, last_error_message: error.message, next_check_at: null }).eq("provider", "aerodatabox");
    return { ok: false, status: "error", activeCases: 0, checkedCases: 0, failedCases: 0, message: error.message };
  }

  const activeCases = rows?.length || 0;
  const now = new Date();
  const nextCheckAt = new Date(now.getTime() + intervalMinutes * 60 * 1000).toISOString();
  if (!activeCases) {
    await supabase.from("airport_transfer_api_health").update({ connection_status: "idle", active_case_count: 0, checked_case_count: 0, failed_case_count: 0, last_check_at: now.toISOString(), last_error_message: null, next_check_at: null }).eq("provider", "aerodatabox");
    return { ok: true, status: "idle", activeCases: 0, checkedCases: 0, failedCases: 0, message: "ไม่มีงานที่อยู่ในช่วงติดตาม จึงไม่เรียก Flight API" };
  }

  const dueBefore = now.getTime() - intervalMinutes * 60 * 1000;
  const dueRows = (rows as CaseRow[]).filter((row) => !row.flight_provider_checked_at || new Date(String(row.flight_provider_checked_at)).getTime() <= dueBefore).slice(0, 10);
  if (!dueRows.length) {
    await supabase.from("airport_transfer_api_health").update({ connection_status: "healthy", active_case_count: activeCases, checked_case_count: 0, failed_case_count: 0, last_check_at: now.toISOString(), last_error_message: null, next_check_at: nextCheckAt }).eq("provider", "aerodatabox");
    return { ok: true, status: "healthy", activeCases, checkedCases: 0, failedCases: 0, message: "ข้อมูลทุกเคสยังใหม่อยู่ ยังไม่ถึงรอบเรียก API" };
  }

  const lockToken = randomUUID();
  const { data: lockClaimed, error: lockError } = await supabase.rpc("claim_airport_transfer_api_sync", { p_token: lockToken, p_lock_seconds: 90 });
  if (lockError) {
    return { ok: false, status: "error", activeCases, checkedCases: 0, failedCases: 0, message: `เริ่มรอบตรวจ API ไม่สำเร็จ: ${lockError.message}` };
  }
  if (!lockClaimed) {
    return { ok: true, status: "healthy", activeCases, checkedCases: 0, failedCases: 0, message: "มีรอบตรวจ Flight API อื่นกำลังทำงานอยู่" };
  }

  await supabase.from("airport_transfer_api_health").update({ active_case_count: activeCases, last_check_at: now.toISOString(), next_check_at: nextCheckAt }).eq("provider", "aerodatabox").eq("sync_lock_token", lockToken);

  let checkedCases = 0;
  let failedCases = 0;
  let notConfigured = false;
  let lastError: string | null = null;

  for (const row of dueRows) {
    const result = await verifyFlightByNumberAndDate(String(row.flight_number), String(row.travel_date));
    if (!result.ok) {
      if (result.reason === "not_configured") {
        notConfigured = true;
        lastError = "ยังไม่ได้ตั้งค่า AERODATABOX_API_KEY";
        break;
      }
      failedCases += 1;
      lastError = result.reason === "not_found" ? `ไม่พบ ${row.flight_number}` : result.detail || "Flight API error";
      await supabase.from("airport_transfer_cases").update({
        flight_verification_status: result.reason === "not_found" ? "not_found" : "provider_unavailable",
        flight_provider_checked_at: new Date().toISOString()
      }).eq("id", row.id);
      continue;
    }

    const matching = result.candidates.filter((candidate) =>
      (!row.origin_airport || candidate.originAirport === row.origin_airport) &&
      (!row.destination_airport || candidate.destinationAirport === row.destination_airport)
    );
    const selected = matching.length === 1 ? matching[0] : result.candidates.length === 1 ? result.candidates[0] : null;
    const checkedAt = new Date().toISOString();
    const verificationStatus = selected ? "verified" : "multiple_matches";
    const updatePayload: Record<string, unknown> = { flight_verification_status: verificationStatus, flight_provider: "aerodatabox", flight_provider_checked_at: checkedAt };
    if (selected) {
      const nextRecommended = recommendedPickup(row.direction, selected.scheduledDepartureAt, selected.scheduledArrivalAt);
      const pickupWasAutomatic = !row.confirmed_pickup_at || row.confirmed_pickup_at === row.recommended_pickup_at;
      Object.assign(updatePayload, {
        origin_airport: selected.originAirport,
        destination_airport: selected.destinationAirport,
        scheduled_departure_at: selected.scheduledDepartureAt,
        scheduled_arrival_at: selected.scheduledArrivalAt,
        recommended_pickup_at: nextRecommended,
        confirmed_pickup_at: pickupWasAutomatic ? nextRecommended : row.confirmed_pickup_at,
        next_action_at: pickupWasAutomatic ? nextRecommended : row.confirmed_pickup_at
      });
    }
    await Promise.all([
      supabase.from("airport_transfer_cases").update(updatePayload).eq("id", row.id),
      supabase.from("airport_transfer_flight_snapshots").insert(result.candidates.map((candidate) => ({
        case_id: row.id,
        provider: "aerodatabox",
        verification_status: verificationStatus,
        scheduled_departure_at: candidate.scheduledDepartureAt,
        estimated_departure_at: candidate.estimatedDepartureAt,
        actual_departure_at: candidate.actualDepartureAt,
        scheduled_arrival_at: candidate.scheduledArrivalAt,
        estimated_arrival_at: candidate.estimatedArrivalAt,
        actual_arrival_at: candidate.actualArrivalAt,
        provider_status: candidate.status,
        confidence: "confirmed",
        raw_payload: candidate.raw
      }))),
      ...(Object.keys(updatePayload).some((key) => key !== "flight_provider_checked_at" && JSON.stringify(row[key] ?? null) !== JSON.stringify(updatePayload[key] ?? null)) ? [supabase.from("airport_transfer_audit_logs").insert({
        case_id: row.id,
        entity_type: "transfer_case",
        entity_id: row.id,
        action: "flight_auto_refreshed",
        old_value: { flight_provider_checked_at: row.flight_provider_checked_at || null },
        new_value: updatePayload,
        metadata: { provider: "aerodatabox", source: "scheduled_sync" }
      })] : [])
    ]);
    checkedCases += 1;
  }

  const finishedAt = new Date().toISOString();
  const status = notConfigured ? "not_configured" : failedCases ? (checkedCases ? "degraded" : "error") : "healthy";
  const healthPayload: Record<string, unknown> = {
    connection_status: status,
    active_case_count: activeCases,
    checked_case_count: checkedCases,
    failed_case_count: failedCases,
    last_check_at: finishedAt,
    last_error_message: lastError,
    next_check_at: notConfigured ? null : nextCheckAt,
    sync_lock_token: null,
    sync_lock_until: null
  };
  if (checkedCases) healthPayload.last_success_at = finishedAt;
  if (failedCases || notConfigured) healthPayload.last_error_at = finishedAt;
  await supabase.from("airport_transfer_api_health").update(healthPayload).eq("provider", "aerodatabox").eq("sync_lock_token", lockToken);

  return {
    ok: status === "healthy" || status === "degraded",
    status,
    activeCases,
    checkedCases,
    failedCases,
    message: notConfigured ? "ยังไม่ได้ตั้งค่า Flight API" : `ตรวจแล้ว ${checkedCases} เคส${failedCases ? ` ผิดพลาด ${failedCases} เคส` : ""}`
  };
}
