import "server-only";

import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

export async function isProjectPublished(projectId: string): Promise<boolean> {
  const { client } = getSupabaseWriteClient();
  if (!client) return false;

  const { data } = await client
    .from("publish_locks")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "locked")
    .maybeSingle();

  return Boolean(data?.id);
}

export async function assertPlanEditable(projectId: string): Promise<{ editable: boolean; reason?: string }> {
  const { client } = getSupabaseWriteClient();
  if (client) {
    const { data: project } = await client.from("projects").select("status").eq("id", projectId).maybeSingle();
    const status = typeof project?.status === "string" ? project.status : "";
    if (["published", "operating", "closing", "closed"].includes(status)) {
      return { editable: false, reason: "โครงการนี้ประกาศใช้แผนแล้ว การแก้ไขต้องส่งเป็นคำขอเปลี่ยนแปลง" };
    }
  }

  if (await isProjectPublished(projectId)) {
    return { editable: false, reason: "แผนของโครงการนี้ถูกล็อกแล้ว การแก้ไขต้องส่งเป็นคำขอเปลี่ยนแปลง" };
  }

  return { editable: true };
}

export async function createPublishLock(projectId: string, snapshotId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  const { client, error } = getSupabaseWriteClient();
  if (!client) return { success: false, error: error || "Supabase is not configured." };

  const { error: insertError } = await client.from("publish_locks").insert({
    project_id: projectId,
    locked_by_snapshot_id: snapshotId,
    status: "locked",
    reason
  });

  if (insertError) return { success: false, error: insertError.message };
  return { success: true };
}

