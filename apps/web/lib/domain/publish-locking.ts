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
  const published = await isProjectPublished(projectId);
  if (!published) return { editable: true };

  return {
    editable: false,
    reason: "Project is published and locked. Create a change request instead of editing the baseline directly."
  };
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

