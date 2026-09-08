"use server";

import { revalidatePath } from "next/cache";
import { createAssignmentSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { requirePermission } from "@/lib/auth/rbac";
import { mapAssignment } from "@/lib/data/mappers";
import { assertPlanEditable } from "@/lib/domain/publish-locking";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createAssignmentTimelineEvent, createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

export async function createAssignmentAction(input: unknown): Promise<ActionResult> {
  const parsed = createAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("ข้อมูลการจัดสรรงานไม่ครบถ้วน", parsed.error.flatten().fieldErrors);
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) {
    return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");
  }

  const permission = await requirePermission(parsed.data.projectId, "assignment.create");
  if (!permission.allowed && mode !== "service_role") {
    return actionFailure(permission.reason || "ไม่มีสิทธิ์สร้างงานที่จัดสรร");
  }

  const editable = await assertPlanEditable(parsed.data.projectId);
  if (!editable.editable) {
    return actionFailure(editable.reason || "โครงการนี้ประกาศใช้แผนแล้ว กรุณาส่งคำขอเปลี่ยนแปลง");
  }

  const { data, error: insertError } = await client
    .from("assignments")
    .insert({
      project_id: parsed.data.projectId,
      mission_id: parsed.data.missionId,
      call_sign_id: parsed.data.callSignId,
      vehicle_id: parsed.data.vehicleId || null,
      driver_id: parsed.data.driverId || null,
      start_time: parsed.data.startTime || null,
      end_time: parsed.data.endTime || null,
      commitment_id: parsed.data.commitmentId || null,
      metadata: parsed.data.metadata
    })
    .select()
    .single();

  if (insertError) {
    return actionFailure(getDatabaseErrorMessage(insertError, "บันทึกงานที่จัดสรรไม่สำเร็จ"));
  }

  const assignment = mapAssignment(data);
  const timelineResult = await createAssignmentTimelineEvent(assignment.projectId, assignment.id, data);

  revalidatePath("/assignments");
  revalidatePath("/resources/vehicles");
  revalidatePath(`/projects/${assignment.projectId}`);
  revalidatePath(`/projects/${assignment.projectId}/assignments`);

  return actionSuccess(
    { mode, assignment, timelineEvent: timelineResult.data },
    timelineResult.success ? undefined : `สร้างงานแล้ว แต่บันทึก Timeline ไม่สำเร็จ: ${timelineResult.error}`
  );
}

export async function cancelAssignmentAction(input: unknown): Promise<ActionResult> {
  const data = input as { projectId?: string; assignmentId?: string; reason?: string };
  if (!data.projectId || !data.assignmentId) return actionFailure("ไม่พบข้อมูลงานที่ต้องการถอน");

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const permission = await requirePermission(data.projectId, "assignment.update");
  if (!permission.allowed && mode !== "service_role") {
    return actionFailure(permission.reason || "ไม่มีสิทธิ์ถอนงานนี้");
  }

  const { data: before, error: readError } = await client
    .from("assignments")
    .select("*")
    .eq("id", data.assignmentId)
    .eq("project_id", data.projectId)
    .maybeSingle();

  if (readError) return actionFailure(getDatabaseErrorMessage(readError, "อ่านข้อมูลงานไม่สำเร็จ"));
  if (!before) return actionFailure("ไม่พบงานนี้ในโครงการ");
  if (before.status === "cancelled") return actionFailure("งานนี้ถูกถอนแล้ว");

  const cancelledAt = new Date().toISOString();
  const { data: updated, error: updateError } = await client
    .from("assignments")
    .update({
      status: "cancelled",
      updated_at: cancelledAt,
      metadata: {
        ...((before.metadata && typeof before.metadata === "object") ? before.metadata : {}),
        cancelledReason: data.reason || "ถอนงานจากหน้าจัดการรถ",
        cancelledAt
      }
    })
    .eq("id", data.assignmentId)
    .eq("project_id", data.projectId)
    .select()
    .single();

  if (updateError) return actionFailure(getDatabaseErrorMessage(updateError, "ถอนงานไม่สำเร็จ"));

  const timelineResult = await createTimelineEvent({
    projectId: data.projectId,
    objectType: "assignment",
    objectId: data.assignmentId,
    eventType: TIMELINE_EVENTS.ASSIGNMENT_CANCELLED,
    source: "operation_user",
    reason: data.reason || "ถอนงานจากหน้าจัดการรถ",
    beforeData: before,
    afterData: updated,
    metadata: { action: "cancel_assignment" }
  });

  revalidatePath("/assignments");
  revalidatePath("/resources/vehicles");
  revalidatePath(`/projects/${data.projectId}`);
  revalidatePath(`/projects/${data.projectId}/assignments`);

  return actionSuccess(
    { assignment: mapAssignment(updated), timelineEvent: timelineResult.data },
    timelineResult.success ? undefined : `ถอนงานแล้ว แต่บันทึก Timeline ไม่สำเร็จ: ${timelineResult.error}`
  );
}
