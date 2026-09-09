"use server";

import { createProjectSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/rbac";
import { mapProject } from "@/lib/data/mappers";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createProjectTimelineEvent } from "@/lib/timeline";

interface PgError {
  code?: string;
  message?: string;
}

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

  const profile = await getCurrentUserProfile();
  const creatorProfileId =
    profile.isDevelopmentFallback || !profile.authUserId || profile.id === "anonymous" ? null : profile.id;

  // Atomic command (migration 0026): the project row, the creator's
  // project_manager membership and the PROJECT_CREATED timeline event (0025
  // trigger) all commit together or not at all.
  const { data, error: rpcError } = await client.rpc("create_project_command", {
    p_organization_id: organizationId,
    p_owner_profile_id: parsed.data.ownerProfileId || null,
    p_creator_profile_id: creatorProfileId,
    p_project_code: parsed.data.projectCode,
    p_project_name: parsed.data.projectName,
    p_start_date: parsed.data.startDate,
    p_end_date: parsed.data.endDate,
    p_timezone: parsed.data.timezone,
    p_visibility: parsed.data.visibilityLevel,
    p_service_level: parsed.data.serviceLevel,
    p_metadata: parsed.data.metadata
  });

  if (rpcError) {
    const err = rpcError as PgError;
    if (err.code === "23505" || /project_code_taken/.test(err.message || "")) {
      return actionFailure("รหัสโครงการนี้ถูกใช้งานแล้ว กรุณากดสร้างรหัสใหม่หรือเปลี่ยนรหัสโครงการ", {
        projectCode: ["รหัสโครงการนี้ถูกใช้งานแล้ว"]
      });
    }
    return actionFailure(getDatabaseErrorMessage(rpcError, "บันทึกโครงการไม่สำเร็จ"));
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  const project = mapProject(row);

  return actionSuccess({ mode, project });
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
