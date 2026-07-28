"use server";

import { createIncidentSchema, updateIncidentStatusSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { requirePermission } from "@/lib/auth/rbac";
import { buildRecoveryRecommendation } from "@/lib/domain/recovery-rules";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent } from "@/lib/timeline";

export async function createIncidentAction(input: unknown): Promise<ActionResult> {
  const parsed = createIncidentSchema.safeParse(input);
  if (!parsed.success) return actionFailure("ข้อมูลเหตุผิดปกติไม่ถูกต้อง", parsed.error.flatten().fieldErrors);

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่า Supabase สำหรับบันทึกเหตุผิดปกติ");

  const permission = await requirePermission(parsed.data.projectId, "timeline.create");
  if (!permission.allowed && mode !== "service_role") return actionFailure(permission.reason || "ไม่มีสิทธิ์บันทึกเหตุผิดปกติ");

  const recommendation = buildRecoveryRecommendation({
    issueType: parsed.data.issueType,
    severity: parsed.data.severity,
    minutesOpen: 0
  });

  const { data, error: insertError } = await client
    .from("driver_issue_reports")
    .insert({
      project_id: parsed.data.projectId,
      assignment_id: parsed.data.assignmentId || null,
      driver_id: parsed.data.driverId || null,
      issue_type: parsed.data.issueType,
      severity: parsed.data.severity === "critical" ? "urgent" : parsed.data.severity,
      message: parsed.data.message,
      status: "open",
      metadata: {
        ...parsed.data.metadata,
        incident: true,
        enterpriseRecovery: true,
        originalSeverity: parsed.data.severity,
        recommendation
      }
    })
    .select()
    .single();

  if (insertError) return actionFailure(`บันทึกเหตุผิดปกติไม่สำเร็จ: ${insertError.message}`);

  const timelineResult = await createTimelineEvent({
    projectId: parsed.data.projectId,
    objectType: "incident",
    objectId: data.id,
    eventType: "INCIDENT_OPENED",
    source: "operation_user",
    reason: parsed.data.message,
    afterData: { incident: data, recommendation },
    metadata: { incident: true, enterpriseRecovery: true }
  });

  return actionSuccess({ mode, incident: data, recommendation, timelineEvent: timelineResult.data }, timelineResult.success ? undefined : timelineResult.error);
}

export async function updateIncidentStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = updateIncidentStatusSchema.safeParse(input);
  if (!parsed.success) return actionFailure("ข้อมูลสถานะเหตุผิดปกติไม่ถูกต้อง", parsed.error.flatten().fieldErrors);

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่า Supabase สำหรับอัปเดตเหตุผิดปกติ");

  const permission = await requirePermission(parsed.data.projectId, "timeline.create");
  if (!permission.allowed && mode !== "service_role") return actionFailure(permission.reason || "ไม่มีสิทธิ์อัปเดตเหตุผิดปกติ");

  const status = parsed.data.status === "closed" || parsed.data.status === "resolved" ? "closed" : parsed.data.status === "acknowledged" ? "acknowledged" : "open";
  const { data, error: updateError } = await client
    .from("driver_issue_reports")
    .update({
      status,
      metadata: {
        ...parsed.data.metadata,
        incidentStatus: parsed.data.status,
        statusUpdatedAt: new Date().toISOString()
      }
    })
    .eq("id", parsed.data.incidentId)
    .eq("project_id", parsed.data.projectId)
    .select()
    .single();

  if (updateError) return actionFailure(`อัปเดตเหตุผิดปกติไม่สำเร็จ: ${updateError.message}`);

  const timelineResult = await createTimelineEvent({
    projectId: parsed.data.projectId,
    objectType: "incident",
    objectId: parsed.data.incidentId,
    eventType: "INCIDENT_STATUS_CHANGED",
    source: "operation_user",
    reason: parsed.data.reason || `เปลี่ยนสถานะเหตุผิดปกติเป็น ${parsed.data.status}`,
    afterData: data,
    metadata: { incident: true, enterpriseRecovery: true }
  });

  return actionSuccess({ mode, incident: data, timelineEvent: timelineResult.data }, timelineResult.success ? undefined : timelineResult.error);
}
