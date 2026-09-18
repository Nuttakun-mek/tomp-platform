import "server-only";

import { cache } from "react";
import { getViewerAccess } from "@/lib/auth/access";
import { getAirportTransferProjectRole } from "@/lib/airport-transfer/project-role";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

export type AirportTransferRole = "airport_admin" | "airport_dispatcher" | "airport_coordinator" | "airport_driver" | "airport_viewer";

export interface AirportTransferAccess {
  allowed: boolean;
  canManage: boolean;
  role: AirportTransferRole | "super_admin" | "development" | null;
  profileId: string;
  signedIn: boolean;
}

/**
 * Airport Transfer access, scoped to one project (docs/11-codex/984 Layer 2):
 * a profile's role now comes from project_members + system_key, the same
 * table Ground Transfer roles already use — not the flat, disconnected
 * airport_transfer_memberships table, which this retires.
 *
 * Called with no projectId, this only answers "does this account hold
 * Airport Transfer access on *some* project" — canManage/role are meaningless
 * without a project, so they come back false/null. That form exists only for
 * the account-level layout gate and the landing page tile.
 */
export const getAirportTransferAccess = cache(async function getAirportTransferAccess(projectId?: string): Promise<AirportTransferAccess> {
  const viewer = await getViewerAccess();
  const signedIn = Boolean(viewer.profile.authUserId) || viewer.profile.isDevelopmentFallback;

  if (viewer.profile.isDevelopmentFallback) {
    return { allowed: true, canManage: true, role: "development", profileId: viewer.profile.id, signedIn: true };
  }

  if (!signedIn) {
    return { allowed: false, canManage: false, role: null, profileId: viewer.profile.id, signedIn: false };
  }

  if (viewer.roleKeys.includes("super_admin")) {
    return { allowed: true, canManage: true, role: "super_admin", profileId: viewer.profile.id, signedIn: true };
  }

  if (projectId) {
    const role = (await getAirportTransferProjectRole(projectId, viewer.profile.id)) as AirportTransferRole | null;
    return {
      allowed: Boolean(role),
      canManage: role === "airport_admin" || role === "airport_dispatcher",
      role,
      profileId: viewer.profile.id,
      signedIn: true
    };
  }

  const supabase = getSupabaseServerDataClient();
  if (!supabase) return { allowed: false, canManage: false, role: null, profileId: viewer.profile.id, signedIn: true };

  const { data } = await supabase
    .from("project_members")
    .select("id")
    .eq("profile_id", viewer.profile.id)
    .eq("system_key", "airport_transfer")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return { allowed: Boolean(data), canManage: false, role: null, profileId: viewer.profile.id, signedIn: true };
});
