"use server";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { sendDriverPush } from "@/lib/driver-access/push";
import { createTimelineEvent } from "@/lib/timeline";

async function recordAcknowledgement(input: {
  projectId: string;
  assignmentId: string;
  driverId?: string | null;
  acknowledgementType: string;
  objectType: string;
  objectId: string;
  eventType: string;
}): Promise<ActionResult> {
  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่า Supabase สำหรับบันทึกการรับทราบ");

  const acknowledgedAt = new Date().toISOString();
  const { data, error: insertError } = await client
    .from("driver_acknowledgements")
    .insert({
      project_id: input.projectId,
      assignment_id: input.assignmentId,
      driver_id: input.driverId || null,
      acknowledgement_type: input.acknowledgementType,
      object_type: input.objectType,
      object_id: input.objectId,
      acknowledged_at: acknowledgedAt,
      metadata: { source: "web_driver" }
    })
    .select()
    .single();

  if (insertError) return actionFailure(`บันทึกการรับทราบไม่สำเร็จ: ${insertError.message}`);

  await createTimelineEvent({
    projectId: input.projectId,
    objectType: input.objectType,
    objectId: input.objectId,
    eventType: input.eventType,
    source: "driver_qr",
    reason: "Driver acknowledged operational instruction.",
    afterData: data
  }).catch(() => undefined);

  return actionSuccess({ acknowledgement: data });
}

export async function acknowledgeDriverNotificationAction(input: { projectId: string; assignmentId: string; notificationId: string; driverId?: string | null }) {
  const result = await recordAcknowledgement({
    projectId: input.projectId,
    assignmentId: input.assignmentId,
    driverId: input.driverId,
    acknowledgementType: "notification",
    objectType: "driver_notification",
    objectId: input.notificationId,
    eventType: "DRIVER_NOTIFICATION_ACKNOWLEDGED"
  });

  if (result.success) {
    const { client } = getSupabaseWriteClient();
    await client?.from("driver_notifications").update({ status: "actioned", read_at: new Date().toISOString(), actioned_at: new Date().toISOString() }).eq("id", input.notificationId);
  }

  return result;
}

export async function acknowledgeRouteChangeAction(input: { projectId: string; assignmentId: string; routeChangeId: string; driverId?: string | null }) {
  const result = await recordAcknowledgement({
    projectId: input.projectId,
    assignmentId: input.assignmentId,
    driverId: input.driverId,
    acknowledgementType: "route_change",
    objectType: "route_change_instruction",
    objectId: input.routeChangeId,
    eventType: "DRIVER_ROUTE_CHANGE_ACKNOWLEDGED"
  });

  if (result.success) {
    const { client } = getSupabaseWriteClient();
    await client?.from("route_change_instructions").update({ status: "acknowledged", acknowledged_by_driver_at: new Date().toISOString() }).eq("id", input.routeChangeId);
  }

  return result;
}

export async function markDriverNotificationReadAction(input: { projectId: string; assignmentId: string; notificationId: string; driverId?: string | null }) {
  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่า Supabase สำหรับบันทึกการอ่านแจ้งเตือน");

  const { data, error: updateError } = await client
    .from("driver_notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("id", input.notificationId)
    .eq("project_id", input.projectId)
    .select()
    .single();

  if (updateError) return actionFailure(`บันทึกการอ่านแจ้งเตือนไม่สำเร็จ: ${updateError.message}`);
  return actionSuccess({ notification: data });
}

// Control centre marks a driver message / issue report as handled.
export async function resolveDriverMessageAction(input: { id: string; projectId: string }): Promise<ActionResult> {
  if (!input.id || !input.projectId) return actionFailure("ข้อมูลไม่ครบ");
  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const { data, error: updateError } = await client
    .from("driver_issue_reports")
    .update({ status: "closed" })
    .eq("id", input.id)
    .eq("project_id", input.projectId)
    .select("id, status")
    .single();

  if (updateError) return actionFailure(getDatabaseErrorMessage(updateError, "อัปเดตสถานะข้อความไม่สำเร็จ"));
  return actionSuccess({ report: data });
}

export async function sendDriverNotificationAction(input: {
  projectId: string;
  assignmentId: string;
  driverId?: string | null;
  title: string;
  body: string;
  priority?: "low" | "normal" | "high" | "critical";
  actionLabel?: string | null;
  actionUrl?: string | null;
}): Promise<ActionResult> {
  if (!input.projectId || !input.assignmentId || !input.title.trim() || !input.body.trim()) {
    return actionFailure("กรุณากรอกหัวข้อและข้อความให้ครบก่อนส่ง");
  }

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const { data, error: insertError } = await client
    .from("driver_notifications")
    .insert({
      project_id: input.projectId,
      assignment_id: input.assignmentId,
      driver_id: input.driverId || null,
      notification_type: "control_message",
      priority: input.priority || "normal",
      title: input.title.trim(),
      body: input.body.trim(),
      action_label: input.actionLabel || "รับทราบ",
      action_url: input.actionUrl || null,
      status: "unread",
      sent_at: new Date().toISOString(),
      metadata: { source: "mission_control" }
    })
    .select()
    .single();

  if (insertError) return actionFailure(getDatabaseErrorMessage(insertError, "ส่งข้อความถึงคนขับไม่สำเร็จ"));

  // Reach the driver even with the app backgrounded. Best effort: the row is
  // already saved and the app also polls, so a failed push costs only the
  // banner, never the message.
  const push = await sendDriverPush(input.assignmentId, {
    title: input.title.trim(),
    body: input.body.trim(),
    priority: input.priority,
    data: { projectId: input.projectId, type: "control_message" }
  }).catch(() => ({ sent: 0 }));

  const timelineResult = await createTimelineEvent({
    projectId: input.projectId,
    objectType: "assignment",
    objectId: input.assignmentId,
    eventType: "DRIVER_NOTIFICATION_SENT",
    source: "operation_user",
    reason: `ส่งข้อความถึงคนขับ: ${input.title.trim()}`,
    afterData: data,
    metadata: { notificationType: "control_message", pushSent: push.sent }
  });

  return actionSuccess({ notification: data, timelineEvent: timelineResult.data, pushSent: push.sent }, timelineResult.success ? undefined : `ส่งข้อความแล้ว แต่บันทึก Timeline ไม่สำเร็จ: ${timelineResult.error}`);
}
