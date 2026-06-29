import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface CurrentUserProfile {
  id: string;
  authUserId: string | null;
  organizationId: string | null;
  fullName: string;
  email: string | null;
  roleLabel: string;
  isDevelopmentFallback: boolean;
}

export async function getCurrentUserProfile(): Promise<CurrentUserProfile> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return {
      id: "development-profile",
      authUserId: null,
      organizationId: "10000000-0000-4000-8000-000000000001",
      fullName: "Development Operator",
      email: null,
      roleLabel: "project_manager placeholder",
      isDevelopmentFallback: true
    };
  }

  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;

  if (!authUser) {
    return {
      id: "anonymous-development-profile",
      authUserId: null,
      organizationId: null,
      fullName: "Not signed in",
      email: null,
      roleLabel: "guest placeholder",
      isDevelopmentFallback: true
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, auth_user_id, organization_id, full_name, email")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  return {
    id: typeof profile?.id === "string" ? profile.id : authUser.id,
    authUserId: authUser.id,
    organizationId: typeof profile?.organization_id === "string" ? profile.organization_id : null,
    fullName: typeof profile?.full_name === "string" ? profile.full_name : authUser.email || "Authenticated user",
    email: typeof profile?.email === "string" ? profile.email : authUser.email || null,
    roleLabel: "authenticated placeholder",
    isDevelopmentFallback: false
  };
}

export interface ProjectMembership {
  projectId: string;
  profileId: string;
  roleKey: string;
  permissions: string[];
  isDevelopmentFallback: boolean;
}

export async function getProjectMembership(projectId: string): Promise<ProjectMembership | null> {
  const profile = await getCurrentUserProfile();

  if (profile.isDevelopmentFallback) {
    return {
      projectId,
      profileId: profile.id,
      roleKey: "project_manager",
      permissions: ["project.read", "project.create", "mission.read", "assignment.read", "timeline.read"],
      isDevelopmentFallback: true
    };
  }

  return null;
}

