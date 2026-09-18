import "server-only";

import { getSupabaseServerDataClient } from "@/lib/supabase/server";

/**
 * The profile's Airport Transfer role on this specific project — from the
 * same project_members table Ground Transfer roles already live in, scoped
 * by system_key. Null when the profile holds no Airport Transfer role on
 * this project (they may still hold one on a different project).
 */
export async function getAirportTransferProjectRole(projectId: string, profileId: string): Promise<string | null> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("project_members")
    .select("roles(role_key)")
    .eq("project_id", projectId)
    .eq("profile_id", profileId)
    .eq("system_key", "airport_transfer")
    .eq("status", "active")
    .maybeSingle();

  const roles = data?.roles as { role_key?: string } | { role_key?: string }[] | null;
  const roleKey = Array.isArray(roles) ? roles[0]?.role_key : roles?.role_key;
  return roleKey ?? null;
}
