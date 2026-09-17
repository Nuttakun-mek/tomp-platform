import "server-only";

import { cache } from "react";
import { getViewerAccess } from "@/lib/auth/access";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

export type AirportTransferRole = "airport_admin" | "airport_dispatcher" | "airport_coordinator" | "airport_driver" | "airport_viewer";

export interface AirportTransferAccess {
  allowed: boolean;
  canManage: boolean;
  role: AirportTransferRole | "super_admin" | "development" | null;
  profileId: string;
  signedIn: boolean;
}

export const getAirportTransferAccess = cache(async function getAirportTransferAccess(): Promise<AirportTransferAccess> {
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

  const supabase = getSupabaseServerDataClient();
  if (!supabase) {
    return { allowed: false, canManage: false, role: null, profileId: viewer.profile.id, signedIn: true };
  }

  const { data } = await supabase
    .from("airport_transfer_memberships")
    .select("role_key, status")
    .eq("profile_id", viewer.profile.id)
    .eq("status", "active")
    .maybeSingle();

  const role = typeof data?.role_key === "string" ? (data.role_key as AirportTransferRole) : null;
  return {
    allowed: Boolean(role),
    canManage: role === "airport_admin" || role === "airport_dispatcher",
    role,
    profileId: viewer.profile.id,
    signedIn: true
  };
});

