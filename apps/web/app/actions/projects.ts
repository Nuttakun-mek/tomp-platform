"use server";

import { createProjectSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/rbac";
import { mapProject } from "@/lib/data/mappers";
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

  const permission = await requirePermission("project.create");
  if (!permission.allowed) {
    return actionFailure(permission.reason || "ไม่มีสิทธิ์สร้างโครงการ");
  }

  // Single-org product: the organisation is resolved here, never sent by the
  // client. A hardcoded id in the form used to cause a foreign-key violation
  // ("ข้อมูลที่เลือกไม่สัมพันธ์กัน") on every project creation.
  const organizationId = await resolveOrganizationId(client, parsed.data.organizationId ?? null);
  if (!organizationId) {
    return actionFailure("ยังไม่มีองค์กรตั้งต้นในระบบ กรุณาติดต่อผู้ดูแลแพลตฟอร์ม");
  }

  const { data: existingProject, error: lookupError } = await client.from("projects").select("id").eq("project_code", parsed.data.projectCode).maybeSingle();
  if (lookupError) {
    return actionFailure(getDatabaseErrorMessage(lookupError, "ตรวจสอบรหัสโครงการไม่สำเร็จ"));
  }

  if (existingProject) {
    return actionFailure("รหัสโครงการนี้ถูกใช้งานแล้ว กรุณากดสร้างรหัสใหม่หรือเปลี่ยนรหัสโครงการ", {
      projectCode: ["รหัสโครงการนี้ถูกใช้งานแล้ว"]
    });
  }

  const { data, error: insertError } = await client
    .from("projects")
    .insert({
      organization_id: organizationId,
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

  // Creator becomes an active project_manager member + owner so RLS (0019) lets
  // them see the project they just made.
  const membershipWarning = await linkCreatorAsProjectManager(client, project.id, parsed.data.ownerProfileId || null);

  const timelineResult = await createProjectTimelineEvent(project.id, project.id, data);

  const warnings = [
    membershipWarning,
    timelineResult.success ? null : `บันทึก Timeline ไม่สำเร็จ: ${timelineResult.error}`
  ].filter(Boolean);

  return actionSuccess(
    { mode, project, timelineEvent: timelineResult.data },
    warnings.length ? `สร้างโครงการแล้ว แต่: ${warnings.join(" · ")}` : undefined
  );
}

export async function archiveProjectAction(input: unknown): Promise<ActionResult> {
  const data = (input ?? {}) as { projectId?: string; restore?: boolean };
  const projectId = String(data.projectId || "");
  if (!projectId) return actionFailure("ไม่พบโครงการ");

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const permission = await requirePermission(projectId, "project.update");
  if (!permission.allowed) {
    return actionFailure(permission.reason || "ไม่มีสิทธิ์จัดการโครงการนี้");
  }

  const nextStatus = data.restore ? "planning" : "archived";
  const { data: row, error: updateError } = await client
    .from("projects")
    .update({ status: nextStatus })
    .eq("id", projectId)
    .select("id, project_name, status")
    .single();

  if (updateError) return actionFailure(getDatabaseErrorMessage(updateError, "อัปเดตสถานะโครงการไม่สำเร็จ"));

  await createProjectTimelineEvent(projectId, projectId, row).catch(() => undefined);
  return actionSuccess({ project: row }, undefined);
}

export async function renameProjectAction(input: unknown): Promise<ActionResult> {
  const data = (input ?? {}) as { projectId?: string; projectName?: string };
  const projectId = String(data.projectId || "");
  const projectName = String(data.projectName || "").trim();
  if (!projectId) return actionFailure("ไม่พบโครงการ");
  if (projectName.length < 2) return actionFailure("ชื่อโครงการสั้นเกินไป");

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const permission = await requirePermission(projectId, "project.update");
  if (!permission.allowed) {
    return actionFailure(permission.reason || "ไม่มีสิทธิ์แก้ไขโครงการนี้");
  }

  const { data: row, error: updateError } = await client
    .from("projects")
    .update({ project_name: projectName })
    .eq("id", projectId)
    .select("id, project_name")
    .single();

  if (updateError) return actionFailure(getDatabaseErrorMessage(updateError, "เปลี่ยนชื่อโครงการไม่สำเร็จ"));
  return actionSuccess({ project: row });
}

type WriteClient = NonNullable<ReturnType<typeof getSupabaseWriteClient>["client"]>;

async function resolveOrganizationId(client: WriteClient, requested: string | null): Promise<string | null> {
  if (requested) {
    const { data } = await client.from("organizations").select("id").eq("id", requested).maybeSingle();
    if (data?.id) return String(data.id);
  }

  const profile = await getCurrentUserProfile();
  if (profile.organizationId) {
    const { data } = await client.from("organizations").select("id").eq("id", profile.organizationId).maybeSingle();
    if (data?.id) return String(data.id);
  }

  const { data: first } = await client.from("organizations").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
  return first?.id ? String(first.id) : null;
}

async function linkCreatorAsProjectManager(client: WriteClient, projectId: string, ownerProfileId: string | null): Promise<string | null> {
  const profile = await getCurrentUserProfile();
  if (profile.isDevelopmentFallback || !profile.authUserId || profile.id === "anonymous") {
    // dev fallback / no session: nothing durable to link
    if (ownerProfileId) await client.from("projects").update({ owner_profile_id: ownerProfileId }).eq("id", projectId);
    return null;
  }

  const { data: role } = await client.from("roles").select("id").eq("role_key", "project_manager").maybeSingle();
  const roleId = typeof role?.id === "string" ? role.id : null;
  if (!roleId) return "ไม่พบบทบาทผู้จัดการโครงการ — ยังไม่ได้เพิ่มผู้สร้างเป็นสมาชิก";

  const { error: memberError } = await client.from("project_members").insert({
    project_id: projectId,
    profile_id: profile.id,
    role_id: roleId,
    status: "active",
    metadata: { source: "project_create" }
  });
  if (memberError && memberError.code !== "23505") {
    return "เพิ่มผู้สร้างเป็นสมาชิกโครงการไม่สำเร็จ";
  }

  const owner = ownerProfileId || profile.id;
  await client.from("projects").update({ owner_profile_id: owner }).eq("id", projectId);
  return null;
}
