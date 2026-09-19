"use server";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { getAirportTransferAccess } from "@/lib/airport-transfer/access";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/rbac";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

// docs/11-codex/985 Part C step 2: enabling/disabling a system is gated on
// project.manage_members (who can edit the project), independent of whether
// the caller personally holds an access role on that system — a project
// manager who never touches Airport Transfer can still turn it on for a
// coordinator to use.
export async function toggleProjectSystemAction(input: unknown): Promise<ActionResult> {
  const data = (input ?? {}) as { projectId?: string; systemKey?: string; enabled?: boolean };
  const projectId = String(data.projectId || "");
  const systemKey = String(data.systemKey || "");
  if (!projectId || !systemKey) return actionFailure("ข้อมูลไม่ครบถ้วน");

  // Every project must keep ground_transfer enabled (migration 0047's
  // create_project_command() already unions it in unconditionally at
  // creation time) — without this guard, this action could delete that
  // project_systems row on request and re-open the orphaned-project bug
  // 0047 was written to close.
  if (systemKey === "ground_transfer" && data.enabled === false) {
    return actionFailure("ไม่สามารถปิดใช้งาน Ground Transfer ได้ ทุกโครงการต้องมีระบบนี้เปิดอยู่เสมอ");
  }

  // Compound OR with Airport Transfer's own project-scoped manager check —
  // same reasoning as the Settings page's entry gate (docs/11-codex/984
  // "Granting access"): requirePermission() can never approve an
  // airport_admin/airport_dispatcher since the 5 Airport Transfer roles
  // hold zero role_permissions rows on purpose.
  const permission = await requirePermission(projectId, "project.manage_members");
  if (!permission.allowed) {
    const airportAccess = await getAirportTransferAccess(projectId);
    if (!airportAccess.canManage) return actionFailure(permission.reason || "ไม่มีสิทธิ์แก้ไขระบบของโครงการนี้");
  }

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  if (data.enabled) {
    const profile = await getCurrentUserProfile();
    const { error: upsertError } = await client
      .from("project_systems")
      .upsert({ project_id: projectId, system_key: systemKey, enabled_by: profile.isDevelopmentFallback ? null : profile.id }, { onConflict: "project_id,system_key" });
    if (upsertError) return actionFailure(getDatabaseErrorMessage(upsertError, "เปิดใช้ระบบไม่สำเร็จ"));
  } else {
    const { error: deleteError } = await client.from("project_systems").delete().eq("project_id", projectId).eq("system_key", systemKey);
    if (deleteError) return actionFailure(getDatabaseErrorMessage(deleteError, "ปิดใช้ระบบไม่สำเร็จ"));
  }

  return actionSuccess({ projectId, systemKey, enabled: Boolean(data.enabled) });
}
