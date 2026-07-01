"use server";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
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
