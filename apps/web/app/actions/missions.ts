"use server";

import { revalidatePath } from "next/cache";
import { createMissionSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { mapMission } from "@/lib/data/mappers";
import { requirePermission } from "@/lib/auth/rbac";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createMissionTimelineEvent } from "@/lib/timeline";
import { daysBetween, isClock, readDutySchedule } from "@/lib/domain/duty-hours";
import { checkMainJobDays, mainJobDays } from "@/lib/domain/job-schedule";
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
    // project_days has no `label` column — operation_date + day_number is all it needs.
    const { data: insertedDay, error: dayInsertError } = await client
      .from("project_days")
      .insert({
        project_id: projectId,
        day_number: 1,
        operation_date: project.start_date || new Date().toISOString().slice(0, 10),
        metadata: { source: "auto_created_for_mission", label: "วันปฏิบัติการหลัก" }
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

  // sessions has no `session_code` column and its status check is
  // draft|ready|operating|closed|archived (no "planning"). A mission's
  // session_id is nullable, so a failed session insert must not block the
  // mission — fall back to no session.
  const { data: insertedSession } = await client
    .from("sessions")
    .insert({
      project_id: projectId,
      project_day_id: projectDayId,
      session_name: "รอบปฏิบัติการหลัก",
      status: "draft",
      metadata: { source: "auto_created_for_mission" }
    })
    .select("id")
    .single();

  return { projectDayId, sessionId: insertedSession?.id ? String(insertedSession.id) : null };
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
  if (!permission.allowed) {
    return actionFailure(permission.reason || "ไม่มีสิทธิ์สร้างภารกิจ");
  }
  const editable = await assertPlanEditable(parsed.data.projectId);
  if (!editable.editable) return actionFailure(editable.reason || "โครงการถูกล็อกแล้ว กรุณาส่งคำขอเปลี่ยนแปลง");

  // The main job must sit inside the project's days — the form limits the date
  // picker, this is the check that holds when the form is bypassed.
  const { data: projectRow } = await client.from("projects").select("start_date, end_date").eq("id", parsed.data.projectId).maybeSingle();
  const dayProblem = checkMainJobDays(
    mainJobDays({ plannedStartTime: parsed.data.plannedStartTime, plannedEndTime: parsed.data.plannedEndTime, metadata: parsed.data.metadata }),
    { startDate: projectRow?.start_date ?? null, endDate: projectRow?.end_date ?? null }
  );
  if (dayProblem) return actionFailure(dayProblem);

  // Clock-in/out for every day of the main job — overtime is measured against these.
  const days = mainJobDays({ plannedStartTime: parsed.data.plannedStartTime, plannedEndTime: parsed.data.plannedEndTime, metadata: parsed.data.metadata });
  const duty = readDutySchedule(parsed.data.metadata);
  const missingDuty = daysBetween(days.from, days.to).filter((day) => !duty[day] || duty[day].start === duty[day].end);
  if (missingDuty.length) return actionFailure(`กำหนดเวลาเข้า-ออกงานให้ครบทุกวัน (ขาด ${missingDuty.length} วัน)`);

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

/** Change one day's clock-in/out on a main job (step 1 set them; days can differ). */
export async function updateMissionDutyHoursAction(input: { projectId: string; missionId: string; date: string; start: string; end: string; applyToFollowing?: boolean }): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !isClock(input.start) || !isClock(input.end) || input.start === input.end) {
    return actionFailure("เวลาเข้า-ออกงานไม่ถูกต้อง");
  }
  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");
  const permission = await requirePermission(input.projectId, "mission.create");
  if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์แก้ภารกิจหลัก");

  const { data: mission, error: readError } = await client
    .from("missions")
    .select("id, metadata, planned_start_time, planned_end_time")
    .eq("id", input.missionId)
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (readError || !mission) return actionFailure("ไม่พบภารกิจหลัก");
  const metadata = (mission.metadata ?? {}) as Record<string, unknown>;
  const range = mainJobDays({ plannedStartTime: mission.planned_start_time, plannedEndTime: mission.planned_end_time, metadata });
  if (input.date < range.from || input.date > range.to) return actionFailure("วันนี้อยู่นอกช่วงของภารกิจหลัก");

  // A change of plan usually holds from that day on: optionally apply it to
  // every later day of the main job too, leaving earlier days as they were.
  const dutyHours = { ...readDutySchedule(metadata) };
  const days = input.applyToFollowing ? daysBetween(input.date, range.to) : [input.date];
  for (const day of days) dutyHours[day] = { start: input.start, end: input.end };
  const { error: updateError } = await client.from("missions").update({ metadata: { ...metadata, dutyHours } }).eq("id", input.missionId);
  if (updateError) return actionFailure(getDatabaseErrorMessage(updateError, "บันทึกเวลาเข้า-ออกงานไม่สำเร็จ"));
  revalidatePath("/projects/[projectCode]/ground-transfer", "layout");
  return actionSuccess({ days: days.length, start: input.start, end: input.end });
}

const isInstant = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));

/**
 * The control room's correction of one unit's day, from the day-close page:
 * when overtime starts (`endAt`), and/or the real clock-out (`clockOutAt`),
 * with a reason. Both null clears the correction. Kept on the unit's main job
 * as metadata.dutyAdjustments[date][callSignId], each change keeping what it
 * replaced; the driver's own clock-in/out rows are never rewritten.
 */
export async function adjustDutyDayAction(input: {
  projectId: string;
  callSignId: string;
  date: string;
  endAt: string | null;
  clockOutAt: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reason = (input.reason ?? "").trim();
  const clearing = !input.endAt && !input.clockOutAt;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return actionFailure("วันที่ไม่ถูกต้อง");
  if ((input.endAt && !isInstant(input.endAt)) || (input.clockOutAt && !isInstant(input.clockOutAt))) return actionFailure("เวลาไม่ถูกต้อง");
  if (!clearing && reason.length < 3) return actionFailure("กรุณาระบุเหตุผลที่แก้เวลา");

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");
  const permission = await requirePermission(input.projectId, "mission.create");
  if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์แก้เวลางาน");

  const { data: callSign } = await client
    .from("call_signs")
    .select("id, metadata")
    .eq("id", input.callSignId)
    .eq("project_id", input.projectId)
    .maybeSingle();
  const missionId = (callSign?.metadata as Record<string, unknown> | null)?.missionId;
  if (typeof missionId !== "string") return actionFailure("หน่วยนี้ยังไม่มีภารกิจหลัก จึงยังแก้เวลาไม่ได้");
  const { data: mission, error: readError } = await client
    .from("missions")
    .select("id, metadata")
    .eq("id", missionId)
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (readError || !mission) return actionFailure("ไม่พบภารกิจหลักของหน่วยนี้");

  const metadata = (mission.metadata ?? {}) as Record<string, unknown>;
  const all = { ...((metadata.dutyAdjustments as Record<string, Record<string, Record<string, unknown>>> | undefined) ?? {}) };
  const day = { ...(all[input.date] ?? {}) };
  const previous = day[input.callSignId] ?? null;
  const history = Array.isArray(previous?.history) ? (previous.history as unknown[]) : [];
  const profile = await getCurrentUserProfile().catch(() => null);
  day[input.callSignId] = {
    endAt: input.endAt || null,
    clockOutAt: input.clockOutAt || null,
    reason: clearing ? reason || "คืนค่าตามระบบ" : reason,
    by: profile?.fullName || profile?.email || profile?.id || null,
    at: new Date().toISOString(),
    history: previous ? [...history, { endAt: previous.endAt ?? null, clockOutAt: previous.clockOutAt ?? null, reason: previous.reason ?? null, by: previous.by ?? null, at: previous.at ?? null }].slice(-20) : []
  };
  all[input.date] = day;

  const { error: updateError } = await client.from("missions").update({ metadata: { ...metadata, dutyAdjustments: all } }).eq("id", mission.id);
  if (updateError) return actionFailure(getDatabaseErrorMessage(updateError, "บันทึกเวลาไม่สำเร็จ"));
  revalidatePath("/projects/[projectCode]/ground-transfer", "layout");
  return actionSuccess({ cleared: clearing });
}
