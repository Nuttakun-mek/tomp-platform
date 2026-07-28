"use server";

import { revalidatePath } from "next/cache";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent } from "@/lib/timeline";

type SmokeProjectRow = {
  id: string;
  project_code: string | null;
  project_name: string | null;
};

function archivedMetadata() {
  return {
    smokeTest: true,
    archivedBy: "data-quality-tool",
    archivedAt: new Date().toISOString()
  };
}

export async function archivePilotSmokeTestDataAction(): Promise<ActionResult<{ archivedProjectCount: number }>> {
  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่า Supabase สำหรับ cleanup ข้อมูลทดสอบ");

  const { data: projects, error: projectError } = await client
    .from("projects")
    .select("id,project_code,project_name")
    .contains("metadata", { smokeTest: true })
    .neq("status", "archived");

  if (projectError) return actionFailure(`อ่านชุดทดสอบไม่สำเร็จ: ${projectError.message}`);

  const smokeProjects = (projects || []) as SmokeProjectRow[];
  const projectIds = smokeProjects.map((project) => project.id);

  if (projectIds.length === 0) {
    return actionSuccess({ archivedProjectCount: 0 }, "ไม่พบชุดทดสอบที่ต้องเก็บ");
  }

  const metadata = archivedMetadata();
  const updates = [
    client.from("driver_access_tokens").update({ status: "revoked", revoked_at: new Date().toISOString(), metadata }).in("project_id", projectIds),
    client.from("driver_location_sessions").update({ status: "offline", stopped_at: new Date().toISOString(), metadata }).in("project_id", projectIds).is("stopped_at", null),
    client.from("route_change_instructions").update({ status: "cancelled", metadata }).in("project_id", projectIds),
    client.from("driver_notifications").update({ status: "expired", expires_at: new Date().toISOString(), metadata }).in("project_id", projectIds),
    client.from("driver_assignment_packets").update({ metadata }).in("project_id", projectIds),
    client.from("assignments").update({ status: "archived", metadata }).in("project_id", projectIds),
    client.from("missions").update({ status: "archived", metadata }).in("project_id", projectIds),
    client.from("sessions").update({ status: "archived", metadata }).in("project_id", projectIds),
    client.from("project_days").update({ status: "archived", metadata }).in("project_id", projectIds),
    client.from("call_signs").update({ status: "archived", metadata }).in("project_id", projectIds),
    client.from("projects").update({ status: "archived", metadata }).in("id", projectIds)
  ];

  for (const update of updates) {
    const { error: updateError } = await update;
    if (updateError) return actionFailure(`เก็บชุดทดสอบไม่สำเร็จ: ${updateError.message}`);
  }

  const { data: profileRows } = await client.from("profiles").select("organization_id").contains("metadata", { smokeTest: true });
  const organizationIds = Array.from(new Set((profileRows || []).map((row) => row.organization_id).filter((id): id is string => typeof id === "string")));

  await client.from("profiles").update({ status: "archived", metadata }).contains("metadata", { smokeTest: true });
  if (organizationIds.length > 0) {
    await client.from("organizations").update({ status: "archived", metadata }).in("id", organizationIds);
  }

  for (const project of smokeProjects) {
    await createTimelineEvent({
      projectId: project.id,
      objectType: "project",
      objectId: project.id,
      eventType: "PILOT_SMOKE_TEST_ARCHIVED",
      source: "system",
      reason: "ผู้ดูแลระบบเก็บชุดทดสอบ Production Pilot จากหน้า Data Quality",
      afterData: {
        projectCode: project.project_code,
        projectName: project.project_name,
        archivedAt: metadata.archivedAt
      },
      metadata: { smokeTest: true, archivedBy: "data-quality-tool" }
    });
  }

  revalidatePath("/admin/data-quality");
  revalidatePath("/projects");
  revalidatePath("/mission-control");

  return actionSuccess({ archivedProjectCount: projectIds.length });
}
