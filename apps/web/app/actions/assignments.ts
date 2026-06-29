"use server";

import { createAssignmentSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { mapAssignment } from "@/lib/data/mappers";
import { requirePermission } from "@/lib/auth/rbac";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createAssignmentTimelineEvent } from "@/lib/timeline";
import { assertPlanEditable } from "@/lib/domain/publish-locking";

export async function createAssignmentAction(input: unknown): Promise<ActionResult> {
  const parsed = createAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("ข้อมูล Assignment ไม่ครบถ้วน", parsed.error.flatten().fieldErrors);
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) {
    return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");
  }

  const permission = await requirePermission(parsed.data.projectId, "assignment.create");
  if (!permission.allowed && mode !== "service_role") {
    return actionFailure(permission.reason || "ไม่มีสิทธิ์สร้าง Assignment");
  }
  const editable = await assertPlanEditable(parsed.data.projectId);
  if (!editable.editable) return actionFailure(editable.reason || "โครงการถูกล็อกแล้ว กรุณาส่งคำขอเปลี่ยนแปลง");

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
    return actionFailure(`บันทึก Assignment ไม่สำเร็จ: ${insertError.message}`);
  }

  const assignment = mapAssignment(data);
  const timelineResult = await createAssignmentTimelineEvent(assignment.projectId, assignment.id, data);

  return actionSuccess(
    { mode, assignment, timelineEvent: timelineResult.data },
    timelineResult.success ? undefined : `สร้าง Assignment แล้ว แต่บันทึก Timeline ไม่สำเร็จ: ${timelineResult.error}`
  );
}
