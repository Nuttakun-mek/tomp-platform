"use server";

import { createMissionSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { mapMission } from "@/lib/data/mappers";
import { requirePermission } from "@/lib/auth/rbac";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createMissionTimelineEvent } from "@/lib/timeline";
import { assertPlanEditable } from "@/lib/domain/publish-locking";

type SupabaseWriteClient = NonNullable<ReturnType<typeof getSupabaseWriteClient>["client"]>;

async function ensureMissionPlanningContainer(
  client: SupabaseWriteClient,
  projectId: string,
  preferredProjectDayId?: string | null,
  preferredSessionId?: string | null
) {
  if (preferredProjectDayId) {
    return {
      projectDayId: preferredProjectDayId,
      sessionId: preferredSessionId || null
    };
  }

  const { data: project, error: projectError } = await client
    .from("projects")
    .select("id, start_date")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project) {
    return { error: "ไม่พบโครงการสำหรับสร้างภารกิจ กรุณาเปิดจากหน้าโครงการอีกครั้ง" };
  }

  const { data: existingDay, error: dayLookupError } = await client
    .from("project_days")
    .select("id")
    .eq("project_id", projectId)
    .order("day_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (dayLookupError) {
    return { error: getDatabaseErrorMessage(dayLookupError, "ตรวจสอบวันปฏิบัติการไม่สำเร็จ") };
  }

  let projectDayId = typeof existingDay?.id === "string" ? existingDay.id : null;
  if (!projectDayId) {
    const { data: insertedDay, error: dayInsertError } = await client
      .from("project_days")
      .insert({
        project_id: projectId,
        day_number: 1,
        operation_date: project.start_date || new Date().toISOString().slice(0, 10),
        label: "วันปฏิบัติการหลัก",
        metadata: { source: "auto_created_for_mission" }
      })
      .select("id")
      .single();

    if (dayInsertError || !insertedDay?.id) {
      return { error: getDatabaseErrorMessage(dayInsertError, "สร้างวันปฏิบัติการไม่สำเร็จ") };
    }
    projectDayId = insertedDay.id;
  }

  if (preferredSessionId) {
    return { projectDayId, sessionId: preferredSessionId };
  }

  const { data: existingSession, error: sessionLookupError } = await client
    .from("sessions")
    .select("id")
    .eq("project_day_id", projectDayId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (sessionLookupError) {
    return { error: getDatabaseErrorMessage(sessionLookupError, "ตรวจสอบรอบปฏิบัติการไม่สำเร็จ") };
  }

  if (existingSession?.id) {
    return { projectDayId, sessionId: String(existingSession.id) };
  }

  const { data: insertedSession, error: sessionInsertError } = await client
    .from("sessions")
    .insert({
      project_id: projectId,
      project_day_id: projectDayId,
      session_code: "MAIN",
      session_name: "รอบปฏิบัติการหลัก",
      status: "planning",
      metadata: { source: "auto_created_for_mission" }
    })
    .select("id")
    .single();

  if (sessionInsertError || !insertedSession?.id) {
    return { error: getDatabaseErrorMessage(sessionInsertError, "สร้างรอบปฏิบัติการไม่สำเร็จ") };
  }

  return { projectDayId, sessionId: String(insertedSession.id) };
}

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

  const planningContainer = await ensureMissionPlanningContainer(
    client,
    parsed.data.projectId,
    parsed.data.projectDayId,
    parsed.data.sessionId
  );

  if ("error" in planningContainer) {
    return actionFailure(planningContainer.error || "เตรียมข้อมูลวันปฏิบัติการไม่สำเร็จ");
  }

  const { data, error: insertError } = await client
    .from("missions")
    .insert({
      project_id: parsed.data.projectId,
      project_day_id: planningContainer.projectDayId,
      session_id: planningContainer.sessionId,
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
    return actionFailure(getDatabaseErrorMessage(insertError, "บันทึกภารกิจไม่สำเร็จ"));
  }

  const mission = mapMission(data);
  const timelineResult = await createMissionTimelineEvent(mission.projectId, mission.id, data);

  return actionSuccess(
    { mode, mission, timelineEvent: timelineResult.data },
    timelineResult.success ? undefined : `สร้างภารกิจแล้ว แต่บันทึก Timeline ไม่สำเร็จ: ${timelineResult.error}`
  );
}
