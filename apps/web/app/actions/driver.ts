"use server";

import {
  assignmentStatusUpdateSchema,
  driverCheckinSchema,
  driverIssueReportSchema,
  vehicleCheckinSchema
} from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDriverAssignmentByToken } from "@/lib/data/driver-access";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { uploadPlatePhoto, uploadVehiclePhoto } from "@/lib/storage/checkin-photos";
import { createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

export async function driverCheckinAction(input: unknown): Promise<ActionResult> {
  const parsed = driverCheckinSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Driver check-in validation failed.", parsed.error.flatten().fieldErrors);
  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "Supabase is not configured for writes.");

  const { data, error: insertError } = await client.from("driver_checkins").insert({
    project_id: parsed.data.projectId,
    assignment_id: parsed.data.assignmentId,
    driver_id: parsed.data.driverId,
    status: parsed.data.status,
    confirmed_name: parsed.data.confirmedName,
    confirmed_phone: parsed.data.confirmedPhone,
    confirmed_vehicle: parsed.data.confirmedVehicle,
    gps_consent: parsed.data.gpsConsent,
    metadata: parsed.data.metadata
  }).select().single();

  if (insertError) return actionFailure(`Driver check-in failed: ${insertError.message}`);
  const timelineResult = await createTimelineEvent({
    projectId: parsed.data.projectId,
    objectType: "assignment",
    objectId: parsed.data.assignmentId,
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

// Token-authed evidence upload from the QR driver page. Project/assignment come
// from the token, never from the form, so a driver can only attach to their own job.
export async function driverEvidenceUploadAction(formData: FormData): Promise<ActionResult> {
  const token = String(formData.get("token") || "");
  const kind = String(formData.get("kind") || "");
  const file = formData.get("file");

  if (!token) return actionFailure("ไม่พบลิงก์งาน");
  if (kind !== "vehicle" && kind !== "plate") return actionFailure("ประเภทรูปไม่ถูกต้อง");
  if (!(file instanceof File) || file.size === 0) return actionFailure("ยังไม่ได้เลือกรูป");

  const access = await getDriverAssignmentByToken(token);
  if (!access) return actionFailure("QR หมดอายุหรือถูกยกเลิก");

  const upload =
    kind === "vehicle"
      ? await uploadVehiclePhoto(access.project.id, access.assignment.id, file)
      : await uploadPlatePhoto(access.project.id, access.assignment.id, file);

  if (!upload.success) return actionFailure(upload.error || "อัปโหลดรูปไม่สำเร็จ");
  return actionSuccess({ kind, path: upload.path });
}

// Records the vehicle-evidence check-in (photo storage paths) for the driver's job.
// Token-authed; paths are storage keys in the private driver-evidence bucket.
export async function recordVehicleEvidenceAction(input: unknown): Promise<ActionResult> {
  const data = (input ?? {}) as { token?: string; vehiclePath?: string | null; platePath?: string | null };
  const token = String(data.token || "");
  if (!token) return actionFailure("ไม่พบลิงก์งาน");

  const access = await getDriverAssignmentByToken(token);
  if (!access) return actionFailure("QR หมดอายุหรือถูกยกเลิก");

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ระบบไม่พร้อมบันทึกข้อมูล");

  const { data: row, error: insertError } = await client
    .from("vehicle_checkins")
    .insert({
      project_id: access.project.id,
      assignment_id: access.assignment.id,
      vehicle_id: access.vehicle.id,
      driver_id: access.driver.id,
      status: "confirmed",
      photo_url: data.vehiclePath || null,
      plate_photo_url: data.platePath || null,
      metadata: { source: "driver_task_view", bucket: "driver-evidence" }
    })
    .select()
    .single();

  if (insertError) return actionFailure(`บันทึกหลักฐานตรวจรถไม่สำเร็จ: ${insertError.message}`);

  await createTimelineEvent({
    projectId: access.project.id,
    objectType: "vehicle",
    objectId: access.vehicle.id,
    eventType: TIMELINE_EVENTS.VEHICLE_CHECKED_IN,
    source: "driver_qr",
    reason: "คนขับส่งรูปรถและป้ายทะเบียนก่อนรับงาน",
    afterData: row
  }).catch(() => undefined);

  return actionSuccess({ checkin: row });
}

export async function assignmentStatusUpdateAction(input: unknown): Promise<ActionResult> {
  const parsed = assignmentStatusUpdateSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Assignment status update validation failed.", parsed.error.flatten().fieldErrors);
  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "Supabase is not configured for writes.");

  const { data, error: insertError } = await client.from("assignment_status_updates").insert({
    project_id: parsed.data.projectId,
    assignment_id: parsed.data.assignmentId,
    driver_id: parsed.data.driverId || null,
    status: parsed.data.status,
    source: parsed.data.source,
    metadata: parsed.data.metadata
  }).select().single();

  if (insertError) return actionFailure(`Assignment status update failed: ${insertError.message}`);
  const timelineResult = await createTimelineEvent({
    projectId: parsed.data.projectId,
    objectType: "assignment",
    objectId: parsed.data.assignmentId,
    eventType: TIMELINE_EVENTS.ASSIGNMENT_STATUS_CHANGED,
    source: parsed.data.source,
    reason: `Driver status update: ${parsed.data.status}`,
    afterData: data
  });
  return actionSuccess({ mode, statusUpdate: data, timelineEvent: timelineResult.data }, timelineResult.success ? undefined : timelineResult.error);
}

export async function driverIssueReportAction(input: unknown): Promise<ActionResult> {
  const parsed = driverIssueReportSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Driver issue report validation failed.", parsed.error.flatten().fieldErrors);
  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "Supabase is not configured for writes.");

  const { data, error: insertError } = await client.from("driver_issue_reports").insert({
    project_id: parsed.data.projectId,
    assignment_id: parsed.data.assignmentId,
    driver_id: parsed.data.driverId || null,
    issue_type: parsed.data.issueType,
    severity: parsed.data.severity,
    message: parsed.data.message || null,
    metadata: parsed.data.metadata
  }).select().single();

  if (insertError) return actionFailure(`Driver issue report failed: ${insertError.message}`);
  const timelineResult = await createTimelineEvent({
    projectId: parsed.data.projectId,
    objectType: "assignment",
    objectId: parsed.data.assignmentId,
    eventType: TIMELINE_EVENTS.DRIVER_ISSUE_REPORTED,
    source: "driver_qr",
    reason: parsed.data.message || "Driver reported an issue.",
    afterData: data
  });
  return actionSuccess({ mode, issueReport: data, timelineEvent: timelineResult.data }, timelineResult.success ? undefined : timelineResult.error);
}
