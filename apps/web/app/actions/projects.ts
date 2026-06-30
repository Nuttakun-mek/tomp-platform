"use server";

import { createProjectSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { mapProject } from "@/lib/data/mappers";
import { requirePermission } from "@/lib/auth/rbac";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createProjectTimelineEvent } from "@/lib/timeline";

export async function createProjectAction(input: unknown): Promise<ActionResult> {
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("ข้อมูลโครงการไม่ครบถ้วน", parsed.error.flatten().fieldErrors);
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) {
    return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");
  }

  const permission = await requirePermission(parsed.data.organizationId, "project.create");
  if (!permission.allowed && mode !== "service_role") {
    return actionFailure(permission.reason || "ไม่มีสิทธิ์สร้างโครงการ");
  }

  const { data: existingProject, error: lookupError } = await client
    .from("projects")
    .select("id")
    .eq("project_code", parsed.data.projectCode)
    .maybeSingle();

  if (lookupError) {
    return actionFailure(getDatabaseErrorMessage(lookupError, "ตรวจสอบรหัสโครงการไม่สำเร็จ"));
  }

  if (existingProject) {
    return actionFailure("รหัสโครงการนี้ถูกใช้แล้ว กรุณาเปลี่ยนรหัสโครงการ", {
      projectCode: ["รหัสโครงการนี้ถูกใช้แล้ว"]
    });
  }

  const { data, error: insertError } = await client
    .from("projects")
    .insert({
      organization_id: parsed.data.organizationId,
      owner_profile_id: parsed.data.ownerProfileId || null,
      project_code: parsed.data.projectCode,
      project_name: parsed.data.projectName,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      timezone: parsed.data.timezone,
      visibility_level: parsed.data.visibilityLevel,
      service_level: parsed.data.serviceLevel,
      metadata: parsed.data.metadata
    })
    .select()
    .single();

  if (insertError) {
    return actionFailure(getDatabaseErrorMessage(insertError, "บันทึกโครงการไม่สำเร็จ"));
  }

  const project = mapProject(data);
  const timelineResult = await createProjectTimelineEvent(project.id, project.id, data);

  return actionSuccess(
    { mode, project, timelineEvent: timelineResult.data },
    timelineResult.success ? undefined : `สร้างโครงการแล้ว แต่บันทึก Timeline ไม่สำเร็จ: ${timelineResult.error}`
  );
}
