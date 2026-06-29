import "server-only";

import { getCurrentUserProfile, getProjectMembership } from "@/lib/auth/current-user";
import { ROLE_PERMISSIONS, roleHasPermission } from "@/lib/auth/permissions";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

export async function requirePermission(first: string, second?: string): Promise<{ allowed: boolean; reason?: string }> {
  const firstLooksLikePermission = first.includes(".");
  const permissionKey = firstLooksLikePermission ? first : String(second);
  const projectId = firstLooksLikePermission ? second : first;

  if (!projectId) {
    const profile = await getCurrentUserProfile();
    const roles = await getUserRoles(profile.id);
    const allowed = roles.some((roleKey) => roleHasPermission(roleKey, permissionKey));
    return allowed ? { allowed: true } : { allowed: false, reason: `No role includes ${permissionKey}.` };
  }

  const membership = await getProjectMembership(projectId);

  if (!membership) {
    return { allowed: false, reason: "No project membership was found." };
  }

  if (!roleHasPermission(membership.roleKey, permissionKey)) {
    return { allowed: false, reason: `Role ${membership.roleKey} does not include ${permissionKey}.` };
  }

  return { allowed: true };
}

export async function hasPermission(profileId: string, permissionKey: string, projectId?: string): Promise<boolean> {
  const roles = await getUserRoles(profileId, projectId);
  return roles.some((roleKey) => roleHasPermission(roleKey, permissionKey));
}

export async function getUserProjectMemberships(profileId: string): Promise<Array<{ projectId: string; roleKey: string }>> {
  if (profileId.startsWith("development")) {
    return [{ projectId: "10000000-0000-4000-8000-000000000003", roleKey: "project_manager" }];
  }

  const supabase = getSupabaseServerDataClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("project_members")
    .select("project_id, role_id, roles(role_key)")
    .eq("profile_id", profileId)
    .eq("status", "active");

  return (data || []).map((row) => {
    const roles = row.roles as { role_key?: string } | { role_key?: string }[] | null;
    const roleKey = Array.isArray(roles) ? roles[0]?.role_key : roles?.role_key;
    return {
      projectId: String(row.project_id),
      roleKey: roleKey || "project_manager"
    };
  });
}

export async function getUserRoles(profileId: string, projectId?: string): Promise<string[]> {
  if (profileId.startsWith("development")) return ["project_manager"];
  const memberships = await getUserProjectMemberships(profileId);
  const scoped = projectId ? memberships.filter((membership) => membership.projectId === projectId) : memberships;
  return scoped.map((membership) => membership.roleKey);
}

async function currentProfileId(): Promise<string> {
  return (await getCurrentUserProfile()).id;
}

export async function canReadProject(projectId: string): Promise<boolean> {
  return hasPermission(await currentProfileId(), "project.read", projectId);
}

export async function canCreateProject(): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  if (profile.isDevelopmentFallback) return true;
  const roles = await getUserRoles(profile.id);
  return roles.some((roleKey) => roleHasPermission(roleKey, "project.create"));
}

export async function canCreateMission(projectId: string): Promise<boolean> {
  return hasPermission(await currentProfileId(), "mission.create", projectId);
}

export async function canCreateAssignment(projectId: string): Promise<boolean> {
  return hasPermission(await currentProfileId(), "assignment.create", projectId);
}

export async function canPublishProject(projectId: string): Promise<boolean> {
  return hasPermission(await currentProfileId(), "project.publish", projectId);
}

export async function canCreateTimeline(projectId: string): Promise<boolean> {
  return hasPermission(await currentProfileId(), "timeline.create", projectId);
}

export async function getUserProjectScope(projectId: string): Promise<{ projectId: string; roleKey: string; permissions: string[]; isDevelopmentFallback: boolean } | null> {
  const membership = await getProjectMembership(projectId);
  if (!membership) return null;

  return {
    projectId: membership.projectId,
    roleKey: membership.roleKey,
    permissions: membership.permissions.length ? membership.permissions : ROLE_PERMISSIONS[membership.roleKey] || [],
    isDevelopmentFallback: membership.isDevelopmentFallback
  };
}
