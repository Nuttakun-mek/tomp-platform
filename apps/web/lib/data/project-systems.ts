import { cache } from "react";
import { resolveReadClient } from "@/lib/supabase/scoped-client";

/** The systems this project has enabled (docs/11-codex/984 Layer 2's project_systems table). */
export const getEnabledSystemKeys = cache(async function getEnabledSystemKeys(projectId: string): Promise<string[]> {
  const { client } = await resolveReadClient();
  if (!client) return ["ground_transfer"];
  const { data, error } = await client.from("project_systems").select("system_key").eq("project_id", projectId);
  if (error || !data) return ["ground_transfer"];
  return data.map((row) => String(row.system_key));
});

/** Every system_key this profile holds ANY active project_members row for, anywhere. */
export const getViewerSystemKeys = cache(async function getViewerSystemKeys(profileId: string): Promise<string[]> {
  const { client } = await resolveReadClient();
  if (!client) return [];
  const { data, error } = await client.from("project_members").select("system_key").eq("profile_id", profileId).eq("status", "active");
  if (error || !data) return [];
  return [...new Set(data.map((row) => String(row.system_key)))];
});
