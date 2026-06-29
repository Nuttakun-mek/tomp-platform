"use server";

import { createMissionSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { mapMission } from "@/lib/data/mappers";
import { requirePermission } from "@/lib/auth/rbac";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createMissionTimelineEvent } from "@/lib/timeline";
import { assertPlanEditable } from "@/lib/domain/publish-locking";

export async function createMissionAction(input: unknown): Promise<ActionResult> {
  const parsed = createMissionSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("ข้อมูลภารกิจไม่ครบถ้วน", parsed.error.flatten().fieldErrors);
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) {
    return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");
  }

  const permission = await requirePermission(parsed.data.projectId, "mission.create");
  if (!permission.allowed && mode !== "service_role") {
    return actionFailure(permission.reason || "ไม่มีสิทธิ์สร้างภารกิจ");
  }
  const editable = await assertPlanEditable(parsed.data.projectId);
  if (!editable.editable) return actionFailure(editable.reason || "โครงการถูกล็อกแล้ว กรุณาส่งคำขอเปลี่ยนแปลง");

  const { data, error: insertError } = await client
    .from("missions")
    .insert({
      project_id: parsed.data.projectId,
      project_day_id: parsed.data.projectDayId,
      session_id: parsed.data.sessionId || null,
      mission_code: parsed.data.missionCode,
      mission_name: parsed.data.missionName,
      mission_type: parsed.data.missionType,
      priority: parsed.data.priority,
      planned_start_time: parsed.data.plannedStartTime || null,
      planned_end_time: parsed.data.plannedEndTime || null,
      pickup_venue_id: parsed.data.pickupVenueId || null,
      dropoff_venue_id: parsed.data.dropoffVenueId || null,
      instruction: parsed.data.instruction || null,
      service_commitment: parsed.data.serviceCommitment || null,
      metadata: parsed.data.metadata
    })
    .select()
    .single();

  if (insertError) {
    return actionFailure(`บันทึกภารกิจไม่สำเร็จ: ${insertError.message}`);
  }

  const mission = mapMission(data);
  const timelineResult = await createMissionTimelineEvent(mission.projectId, mission.id, data);

  return actionSuccess(
    { mode, mission, timelineEvent: timelineResult.data },
    timelineResult.success ? undefined : `สร้างภารกิจแล้ว แต่บันทึก Timeline ไม่สำเร็จ: ${timelineResult.error}`
  );
}
