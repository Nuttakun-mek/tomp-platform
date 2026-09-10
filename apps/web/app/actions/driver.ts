"use server";

import {
  assignmentStatusUpdateSchema,
  driverCheckinSchema,
  driverIssueReportSchema,
  vehicleCheckinSchema
} from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { resolveDriverSessionFromCookies } from "@/lib/api/driver-token";
import { isTrustedDriverScope, type DriverScope, type TrustedDriverScope } from "@/lib/driver/trusted-scope";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { uploadPlatePhoto, uploadVehiclePhoto } from "@/lib/storage/checkin-photos";
import { createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

const SESSION_EXPIRED = "เซสชันคนขับหมดอายุ กรุณาเปิดงานจาก QR และยืนยันรหัสอีกครั้ง";

// The scoped driver session is authoritative for project/assignment/driver —
// callers cannot act on a job they did not open through the QR + PIN flow.
async function driverScope(trusted?: TrustedDriverScope): Promise<DriverScope | null> {
  if (isTrustedDriverScope(trusted)) return trusted;
  const session = await resolveDriverSessionFromCookies();
  return session ? { projectId: session.projectId, assignmentId: session.assignmentId, driverId: session.driverId, callSignId: session.callSignId || null } : null;
}

async function hasOtherActiveJob(scope: DriverScope, client: NonNullable<ReturnType<typeof getSupabaseWriteClient>["client"]>) {
  const { data: assignment } = await client
    .from("assignments")
    .select("call_sign_id")
    .eq("id", scope.assignmentId)
    .eq("project_id", scope.projectId)
    .maybeSingle();
  const callSignId = typeof assignment?.call_sign_id === "string" ? assignment.call_sign_id : scope.callSignId;
  if (!callSignId) return false;
  const { data } = await client
    .from("assignments")
    .select("id")
    .eq("project_id", scope.projectId)
    .eq("call_sign_id", callSignId)
    .eq("status", "active")
    .neq("id", scope.assignmentId)
    .limit(1);
  return Boolean(data?.length);
}

export async function driverCheckinAction(input: unknown, trusted?: TrustedDriverScope): Promise<ActionResult> {
  const parsed = driverCheckinSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Driver check-in validation failed.", parsed.error.flatten().fieldErrors);
  const scope = await driverScope(trusted);
  if (!scope) return actionFailure(SESSION_EXPIRED);
  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "Supabase is not configured for writes.");

  const { data, error: insertError } = await client.from("driver_checkins").insert({
    project_id: scope.projectId,
    assignment_id: scope.assignmentId,
    driver_id: scope.driverId,
    status: parsed.data.status,
    confirmed_name: parsed.data.confirmedName,
    confirmed_phone: parsed.data.confirmedPhone,
    confirmed_vehicle: parsed.data.confirmedVehicle,
    gps_consent: parsed.data.gpsConsent,
    metadata: parsed.data.metadata
  }).select().single();

  if (insertError) return actionFailure(`Driver check-in failed: ${insertError.message}`);

  // Driver passed pre-flight and confirmed readiness → the assignment is live.
  if (parsed.data.status === "ready") {
    if (await hasOtherActiveJob(scope, client)) {
      return actionFailure("Call Sign นี้มีงานที่กำลังปฏิบัติการอยู่แล้ว กรุณาให้ศูนย์ควบคุมพักหรือปิดงานเดิมก่อน");
    }
    await client
      .from("assignments")
      .update({ status: "active" })
      .eq("id", scope.assignmentId)
      .in("status", ["draft", "planned", "published", "acknowledged", "parked"]);
  }

  const timelineResult = await createTimelineEvent({
    projectId: scope.projectId,
    objectType: "assignment",
    objectId: scope.assignmentId,
    eventType: TIMELINE_EVENTS.DRIVER_CHECKED_IN,
    source: "driver_qr",
    reason: "Driver activation check-in submitted.",
    afterData: data
  });
  return actionSuccess({ mode, checkin: data, timelineEvent: timelineResult.data }, timelineResult.success ? undefined : timelineResult.error);
}

export async function vehicleCheckinAction(input: unknown): Promise<ActionResult> {
  const parsed = vehicleCheckinSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Vehicle check-in validation failed.", parsed.error.flatten().fieldErrors);
  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "Supabase is not configured for writes.");

  const { data, error: insertError } = await client.from("vehicle_checkins").insert({
    project_id: parsed.data.projectId,
    assignment_id: parsed.data.assignmentId,
    vehicle_id: parsed.data.vehicleId,
    driver_id: parsed.data.driverId || null,
    status: parsed.data.status,
    photo_url: parsed.data.photoUrl || null,
    plate_photo_url: parsed.data.platePhotoUrl || null,
    metadata: parsed.data.metadata
  }).select().single();

  if (insertError) return actionFailure(`Vehicle check-in failed: ${insertError.message}`);
  const timelineResult = await createTimelineEvent({
    projectId: parsed.data.projectId,
    objectType: "vehicle",
    objectId: parsed.data.vehicleId,
    eventType: TIMELINE_EVENTS.VEHICLE_CHECKED_IN,
    source: "driver_qr",
    reason: "Vehicle readiness check-in submitted.",
    afterData: data
  });
  return actionSuccess({ mode, checkin: data, timelineEvent: timelineResult.data }, timelineResult.success ? undefined : timelineResult.error);
}

export async function vehiclePhotoUploadAction(formData: FormData): Promise<ActionResult> {
  const projectId = String(formData.get("projectId") || "");
  const assignmentId = String(formData.get("assignmentId") || "");
  const vehicleFile = formData.get("vehiclePhoto");
  const plateFile = formData.get("platePhoto");

  if (!projectId || !assignmentId) return actionFailure("projectId and assignmentId are required.");

  const uploads: Record<string, unknown> = {};
  if (vehicleFile instanceof File && vehicleFile.size > 0) {
    uploads.vehicle = await uploadVehiclePhoto(projectId, assignmentId, vehicleFile);
  }
  if (plateFile instanceof File && plateFile.size > 0) {
    uploads.plate = await uploadPlatePhoto(projectId, assignmentId, plateFile);
  }

  if (!uploads.vehicle && !uploads.plate) {
    return actionSuccess({ mode: "placeholder", uploads }, "No files were selected; stored checklist metadata only.");
  }

  return actionSuccess({ uploads });
}

// Records the vehicle-evidence check-in (photo storage paths) for the driver's job.
// Session-authed; paths are storage keys in the private driver-evidence bucket.
export async function recordVehicleEvidenceAction(input: unknown, trusted?: TrustedDriverScope): Promise<ActionResult> {
  const data = (input ?? {}) as { vehiclePath?: string | null; platePath?: string | null };
  const scope = await driverScope(trusted);
  if (!scope) return actionFailure(SESSION_EXPIRED);

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ระบบไม่พร้อมบันทึกข้อมูล");

  const { data: vehicleRow } = await client.from("assignments").select("vehicle_id").eq("id", scope.assignmentId).maybeSingle();
  const vehicleId = typeof vehicleRow?.vehicle_id === "string" ? vehicleRow.vehicle_id : null;

  const { data: row, error: insertError } = await client
    .from("vehicle_checkins")
    .insert({
      project_id: scope.projectId,
      assignment_id: scope.assignmentId,
      vehicle_id: vehicleId,
      driver_id: scope.driverId,
      status: "confirmed",
      photo_url: data.vehiclePath || null,
      plate_photo_url: data.platePath || null,
      metadata: { source: "driver_task_view", bucket: "driver-evidence" }
    })
    .select()
    .single();

  if (insertError) return actionFailure(`บันทึกหลักฐานตรวจรถไม่สำเร็จ: ${insertError.message}`);

  await createTimelineEvent({
    projectId: scope.projectId,
    objectType: "vehicle",
    objectId: vehicleId || scope.assignmentId,
    eventType: TIMELINE_EVENTS.VEHICLE_CHECKED_IN,
    source: "driver_qr",
    reason: "คนขับส่งรูปรถและป้ายทะเบียนก่อนรับงาน",
    afterData: row
  }).catch(() => undefined);

  return actionSuccess({ checkin: row });
}

export async function assignmentStatusUpdateAction(input: unknown, trusted?: TrustedDriverScope): Promise<ActionResult> {
  const parsed = assignmentStatusUpdateSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Assignment status update validation failed.", parsed.error.flatten().fieldErrors);
  const scope = await driverScope(trusted);
  if (!scope) return actionFailure(SESSION_EXPIRED);
  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "Supabase is not configured for writes.");

  const { data, error: insertError } = await client.from("assignment_status_updates").insert({
    project_id: scope.projectId,
    assignment_id: scope.assignmentId,
    driver_id: scope.driverId,
    status: parsed.data.status,
    source: parsed.data.source,
    metadata: parsed.data.metadata
  }).select().single();

  if (insertError) return actionFailure(`Assignment status update failed: ${insertError.message}`);

  // Reflect the driver's progress on the assignment itself so every control-centre
  // view (task cards, dispatch board, project overview) shows a live status —
  // the detailed step still lives in assignment_status_updates.
  if (parsed.data.status !== "completed" && parsed.data.status !== "blocked" && await hasOtherActiveJob(scope, client)) {
    return actionFailure("Call Sign นี้มีงานที่กำลังปฏิบัติการอยู่แล้ว กรุณาให้ศูนย์ควบคุมพักหรือปิดงานเดิมก่อน");
  }

  const planStatus = parsed.data.status === "completed"
    ? "completed"
    : parsed.data.status === "acknowledged"
      ? "acknowledged"
      : parsed.data.status === "blocked"
        ? "parked"
        : "active";
  await client
    .from("assignments")
    .update({ status: planStatus })
    .eq("id", scope.assignmentId)
    .in("status", ["draft", "planned", "published", "acknowledged", "active", "parked"]);

  if (parsed.data.status === "acknowledged") {
    await client.from("driver_acknowledgements").insert({
      project_id: scope.projectId,
      assignment_id: scope.assignmentId,
      call_sign_id: scope.callSignId || null,
      driver_id: scope.driverId,
      acknowledgement_type: "assignment_received",
      object_type: "assignment",
      object_id: scope.assignmentId,
      metadata: { source: parsed.data.source }
    });
  }

  const timelineResult = await createTimelineEvent({
    projectId: scope.projectId,
    objectType: "assignment",
    objectId: scope.assignmentId,
    eventType: TIMELINE_EVENTS.ASSIGNMENT_STATUS_CHANGED,
    source: parsed.data.source,
    reason: `Driver status update: ${parsed.data.status}`,
    afterData: data
  });
  return actionSuccess({ mode, statusUpdate: data, timelineEvent: timelineResult.data }, timelineResult.success ? undefined : timelineResult.error);
}

export async function driverIssueReportAction(input: unknown, trusted?: TrustedDriverScope): Promise<ActionResult> {
  const parsed = driverIssueReportSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Driver issue report validation failed.", parsed.error.flatten().fieldErrors);
  const scope = await driverScope(trusted);
  if (!scope) return actionFailure(SESSION_EXPIRED);
  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "Supabase is not configured for writes.");

  const { data, error: insertError } = await client.from("driver_issue_reports").insert({
    project_id: scope.projectId,
    assignment_id: scope.assignmentId,
    driver_id: scope.driverId,
    issue_type: parsed.data.issueType,
    severity: parsed.data.severity,
    message: parsed.data.message || null,
    metadata: parsed.data.metadata
  }).select().single();

  if (insertError) return actionFailure(`Driver issue report failed: ${insertError.message}`);
  const timelineResult = await createTimelineEvent({
    projectId: scope.projectId,
    objectType: "assignment",
    objectId: scope.assignmentId,
    eventType: TIMELINE_EVENTS.DRIVER_ISSUE_REPORTED,
    source: "driver_qr",
    reason: parsed.data.message || "Driver reported an issue.",
    afterData: data
  });
  return actionSuccess({ mode, issueReport: data, timelineEvent: timelineResult.data }, timelineResult.success ? undefined : timelineResult.error);
}
