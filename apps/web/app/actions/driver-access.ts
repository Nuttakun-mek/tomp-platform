"use server";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { requirePermission } from "@/lib/auth/rbac";
import { buildDriverAccessUrl } from "@/lib/driver-access/url";
import { generateDriverAccessToken, getDefaultDriverTokenExpiry, hashDriverAccessToken } from "@/lib/driver-access/token";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

type Row = Record<string, unknown>;

function text(row: Row | null | undefined, key: string, fallback = "") {
  const value = row?.[key];
  return typeof value === "string" ? value : fallback;
}

function metadata(row: Row | null | undefined) {
  const value = row?.metadata;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function buildPacketPayload(input: {
  project: Row;
  assignment: Row;
  callSign: Row;
  driver?: Row | null;
  vehicle?: Row | null;
  mission?: Row | null;
}) {
  const pickup = text(input.assignment, "pickup_location", text(metadata(input.assignment), "pickupLocation", "ยังไม่ระบุจุดรับ"));
  const dropoff = text(input.assignment, "dropoff_location", text(metadata(input.assignment), "dropoffLocation", "ยังไม่ระบุจุดส่ง"));
  const assignmentId = text(input.assignment, "id");
  const projectId = text(input.project, "id");
  const driverId = text(input.driver, "id") || text(input.assignment, "driver_id") || null;
  const callSign = text(input.callSign, "call_sign", "ยังไม่ระบุ");
  const currentVersion = typeof input.assignment.current_version === "number" ? input.assignment.current_version : 1;

  return {
    id: assignmentId,
    projectId,
    assignmentId,
    driverId,
    callSign,
    status: "assigned",
    packetVersion: currentVersion,
    projectName: text(input.project, "project_name", "ยังไม่ระบุโครงการ"),
    missionName: text(input.mission, "mission_name") || null,
    instructions: [
      { id: assignmentId, title: "รับทราบงาน", status: "assigned", sequence: 1, required: true },
      { id: text(input.callSign, "id", assignmentId), title: "ยืนยันความพร้อม", status: "acknowledged", sequence: 2, required: true }
    ],
    routeInstruction: {
      routePlan: {
        summary: `${pickup} ไป ${dropoff}`,
        stops: [{ label: pickup }, { label: dropoff }],
        googleMapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(dropoff)}`,
        metadata: {}
      },
      pickup: { label: pickup },
      dropoff: { label: dropoff }
    },
    contactInstruction: {
      coordinatorPhone: text(metadata(input.assignment), "coordinatorPhone", "ยังไม่ระบุ"),
      operationPhone: text(metadata(input.assignment), "operationPhone", "ยังไม่ระบุ")
    },
    safetyInstructions: [{ message: "เปิด GPS ระหว่างปฏิบัติงานเมื่อพร้อม", required: true }],
    publishedAt: new Date().toISOString(),
    acknowledgedAt: null,
    metadata: {
      vehiclePlate: text(input.vehicle, "plate_number") || null,
      driverName: text(input.driver, "full_name") || null
    }
  };
}

async function createAssignmentPacket(client: NonNullable<ReturnType<typeof getSupabaseWriteClient>["client"]>, projectId: string, assignmentId: string, explicitDriverId?: string | null) {
  const [{ data: project }, { data: assignment }] = await Promise.all([
    client.from("projects").select("*").eq("id", projectId).maybeSingle(),
    client.from("assignments").select("*").eq("id", assignmentId).maybeSingle()
  ]);

  if (!project || !assignment) return null;

  const [{ data: callSign }, { data: driver }, { data: vehicle }, { data: mission }] = await Promise.all([
    client.from("call_signs").select("*").eq("id", assignment.call_sign_id).maybeSingle(),
    assignment.driver_id || explicitDriverId ? client.from("drivers").select("*").eq("id", explicitDriverId || assignment.driver_id).maybeSingle() : Promise.resolve({ data: null }),
    assignment.vehicle_id ? client.from("vehicles").select("*").eq("id", assignment.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    assignment.mission_id ? client.from("missions").select("*").eq("id", assignment.mission_id).maybeSingle() : Promise.resolve({ data: null })
  ]);

  if (!callSign) return null;

  const packet = buildPacketPayload({ project, assignment, callSign, driver, vehicle, mission });
  const { data: packetRow, error } = await client
    .from("driver_assignment_packets")
    .insert({
      project_id: projectId,
      assignment_id: assignmentId,
      driver_id: explicitDriverId || assignment.driver_id || null,
      packet_version: packet.packetVersion,
      payload: packet,
      published_at: packet.publishedAt,
      metadata: { source: "createDriverAccessTokenAction" }
    })
    .select("id, packet_version, published_at")
    .single();

  if (error) return null;
  return { packet, packetRecord: packetRow };
}

export async function createDriverAccessTokenAction(input: unknown): Promise<ActionResult> {
  const data = input as { projectId?: string; assignmentId?: string; driverId?: string | null; expiresAt?: string | null };
  if (!data.projectId || !data.assignmentId) {
    return actionFailure("กรุณาเลือกโครงการและ Assignment");
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const permission = await requirePermission(data.projectId, "assignment.update");
  if (!permission.allowed && mode !== "service_role") {
    return actionFailure(permission.reason || "ไม่มีสิทธิ์สร้างลิงก์ QR สำหรับคนขับ");
  }

  const token = generateDriverAccessToken({
    assignmentId: data.assignmentId,
    driverId: data.driverId,
    expiresAt: data.expiresAt
  });
  const expiresAt = data.expiresAt || getDefaultDriverTokenExpiry();

  const { data: row, error: insertError } = await client
    .from("driver_access_tokens")
    .insert({
      project_id: data.projectId,
      assignment_id: data.assignmentId,
      driver_id: data.driverId || null,
      token_hash: hashDriverAccessToken(token),
      status: "active",
      expires_at: expiresAt,
      metadata: { tokenVersion: 1 }
    })
    .select()
    .single();

  if (insertError) return actionFailure(getDatabaseErrorMessage(insertError, "สร้างลิงก์ QR สำหรับคนขับไม่สำเร็จ"));

  const packetResult = await createAssignmentPacket(client, data.projectId, data.assignmentId, data.driverId);
  const timelineResult = await createTimelineEvent({
    projectId: data.projectId,
    objectType: "assignment",
    objectId: data.assignmentId,
    eventType: TIMELINE_EVENTS.DRIVER_ACCESS_TOKEN_CREATED,
    source: "operation_user",
    reason: "Driver QR token and assignment packet created.",
    afterData: { tokenId: row.id, expiresAt, packetRecord: packetResult?.packetRecord || null }
  });

  return actionSuccess({
    token,
    accessUrl: buildDriverAccessUrl(token),
    tokenRecord: { id: row.id, expires_at: row.expires_at, status: row.status },
    packetRecord: packetResult?.packetRecord || null,
    timelineEvent: timelineResult.data
  });
}

export async function revokeDriverAccessTokenAction(input: unknown): Promise<ActionResult> {
  const data = input as { projectId?: string; tokenId?: string; reason?: string | null };
  if (!data.projectId || !data.tokenId) return actionFailure("กรุณาเลือกโครงการและลิงก์ QR");

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const permission = await requirePermission(data.projectId, "assignment.update");
  if (!permission.allowed && mode !== "service_role") return actionFailure(permission.reason || "ไม่มีสิทธิ์ยกเลิกลิงก์ QR สำหรับคนขับ");

  const { data: row, error: updateError } = await client
    .from("driver_access_tokens")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), metadata: { reason: data.reason || "Revoked by operation user" } })
    .eq("id", data.tokenId)
    .eq("project_id", data.projectId)
    .select("id, assignment_id, status, revoked_at")
    .single();

  if (updateError) return actionFailure(getDatabaseErrorMessage(updateError, "ยกเลิกลิงก์ QR สำหรับคนขับไม่สำเร็จ"));

  const timelineResult = await createTimelineEvent({
    projectId: data.projectId,
    objectType: "assignment",
    objectId: row.assignment_id,
    eventType: TIMELINE_EVENTS.DRIVER_ACCESS_TOKEN_REVOKED,
    source: "operation_user",
    reason: data.reason || "Driver QR token revoked.",
    afterData: { tokenId: row.id, status: row.status }
  });

  return actionSuccess({ tokenRecord: row, timelineEvent: timelineResult.data });
}

export async function validateDriverAccessTokenAction(input: unknown): Promise<ActionResult> {
  const token = typeof input === "object" && input && "token" in input ? String(input.token) : "";
  if (!token) return actionFailure("ไม่พบ token สำหรับคนขับ");

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการตรวจสอบลิงก์คนขับ");

  const { data: row, error: lookupError } = await client
    .from("driver_access_tokens")
    .select("id, project_id, assignment_id, driver_id, status, expires_at")
    .eq("token_hash", hashDriverAccessToken(token))
    .maybeSingle();

  if (lookupError) return actionFailure(getDatabaseErrorMessage(lookupError, "ตรวจสอบลิงก์คนขับไม่สำเร็จ"));
  if (!row || row.status !== "active") return actionFailure("ลิงก์คนขับไม่ถูกต้องหรือถูกยกเลิกแล้ว");
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return actionFailure("ลิงก์คนขับหมดอายุแล้ว");

  await client
    .from("driver_access_tokens")
    .update({ last_accessed_at: new Date().toISOString(), used_at: new Date().toISOString(), access_count: 1 })
    .eq("id", row.id);

  await createTimelineEvent({
    projectId: row.project_id,
    objectType: "assignment",
    objectId: row.assignment_id,
    eventType: TIMELINE_EVENTS.DRIVER_ACCESS_TOKEN_USED,
    source: "driver_qr",
    reason: "Driver QR token validated.",
    afterData: { tokenId: row.id }
  });

  return actionSuccess({ projectId: row.project_id, assignmentId: row.assignment_id, tokenId: row.id });
}
