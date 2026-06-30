"use server";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { requirePermission } from "@/lib/auth/rbac";
import { buildDriverAccessUrl } from "@/lib/driver-access/url";
import { generateDriverAccessToken, getDefaultDriverTokenExpiry, hashDriverAccessToken } from "@/lib/driver-access/token";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

export async function createDriverAccessTokenAction(input: unknown): Promise<ActionResult> {
  const data = input as { projectId?: string; assignmentId?: string; driverId?: string | null; expiresAt?: string | null };
  if (!data.projectId || !data.assignmentId) {
    return actionFailure("กรุณาเลือกโครงการและ Assignment");
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const permission = await requirePermission(data.projectId, "assignment.update");
  if (!permission.allowed && mode !== "service_role") return actionFailure(permission.reason || "ไม่มีสิทธิ์สร้างลิงก์ QR สำหรับคนขับ");

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
  const timelineResult = await createTimelineEvent({
    projectId: data.projectId,
    objectType: "assignment",
    objectId: data.assignmentId,
    eventType: TIMELINE_EVENTS.DRIVER_ACCESS_TOKEN_CREATED,
    source: "operation_user",
    reason: "Driver QR token created for assignment-scoped access.",
    afterData: { tokenId: row.id, expiresAt }
  });

  return actionSuccess({ token, accessUrl: buildDriverAccessUrl(token), tokenRecord: { id: row.id, expires_at: row.expires_at, status: row.status }, timelineEvent: timelineResult.data });
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
    .select("id, project_id, assignment_id, status, expires_at")
    .eq("token_hash", hashDriverAccessToken(token))
    .maybeSingle();

  if (lookupError) return actionFailure(getDatabaseErrorMessage(lookupError, "ตรวจสอบลิงก์คนขับไม่สำเร็จ"));
  if (!row || row.status !== "active") return actionFailure("ลิงก์คนขับไม่ถูกต้องหรือถูกยกเลิกแล้ว");
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return actionFailure("ลิงก์คนขับหมดอายุแล้ว");

  await client
    .from("driver_access_tokens")
    .update({ last_accessed_at: new Date().toISOString(), last_used_at: new Date().toISOString(), access_count: 1, usage_count: 1 })
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
