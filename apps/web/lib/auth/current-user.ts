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
    return pilotFallbackProfile("development-profile", "โหมดทดสอบภายใน");
  }

  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;

  if (!authUser) {
    return pilotFallbackProfile("anonymous-pilot-profile", "ยังไม่เปิดใช้ Auth production");
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
    fullName: typeof profile?.full_name === "string" ? profile.full_name : authUser.email || "ผู้ใช้ที่เข้าสู่ระบบ",
    email: typeof profile?.email === "string" ? profile.email : authUser.email || null,
    roleLabel: "ผู้ใช้ที่เข้าสู่ระบบ",
    isDevelopmentFallback: false
  };
}

function pilotFallbackProfile(id: string, roleLabel: string): CurrentUserProfile {
  return {
    id,
    authUserId: null,
    organizationId: "10000000-0000-4000-8000-000000000001",
    fullName: "ผู้ดูแล Pilot",
    email: null,
    roleLabel,
    isDevelopmentFallback: true
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
      permissions: [
        "project.read",
        "project.create",
        "project.publish",
        "mission.read",
        "mission.create",
        "assignment.read",
        "assignment.create",
        "driver.create",
        "vehicle.create",
        "timeline.read",
        "timeline.create",
        "change.create",
        "change.approve",
        "change.apply"
      ],
      isDevelopmentFallback: true
    };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("project_members")
    .select("project_id, profile_id, role_id")
    .eq("project_id", projectId)
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .maybeSingle();

  const roleId = typeof data?.role_id === "string" ? data.role_id : null;
  if (!roleId) return null;

  const { data: role } = await supabase.from("roles").select("role_key").eq("id", roleId).maybeSingle();

  const roleKey = typeof role?.role_key === "string" ? role.role_key : null;
  if (typeof roleKey !== "string") return null;

  return {
    projectId,
    profileId: profile.id,
    roleKey,
    permissions: [],
    isDevelopmentFallback: false
  };
}
