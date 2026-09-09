import "server-only";

import { getCurrentUserProfile, getProjectMembership } from "@/lib/auth/current-user";
import { ROLE_PERMISSIONS, isGlobalPermission, roleHasPermission } from "@/lib/auth/permissions";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

export async function requirePermission(first: string, second?: string): Promise<{ allowed: boolean; reason?: string }> {
  const firstLooksLikePermission = first.includes(".");
  const permissionKey = firstLooksLikePermission ? first : String(second);
  const projectId = firstLooksLikePermission ? second : first;

  // Global/org-scoped permissions (e.g. project.create) are never granted through
  // project_members — check global + org roles even when an id was passed in.
  if (!projectId || isGlobalPermission(permissionKey)) {
    const profile = await getCurrentUserProfile();
    if (profile.isDevelopmentFallback) return { allowed: true };
    const roles = await getUserRoles(profile.id);
    const allowed = roles.some((roleKey) => roleHasPermission(roleKey, permissionKey));
    return allowed ? { allowed: true } : { allowed: false, reason: `No role includes ${permissionKey}.` };
  }

  const profile = await getCurrentUserProfile();
  if (profile.isDevelopmentFallback) return { allowed: true };

  const membership = await getProjectMembership(projectId);
  if (membership && roleHasPermission(membership.roleKey, permissionKey)) {
    return { allowed: true };
  }

  // A platform-level role (super_admin) acts on every project without a
  // project_members row. This is the ONLY sanctioned way past the membership
  // check — the service-role transport is not authorization.
  const globalRoles = await getGlobalRoleKeys(profile.id);
  if (globalRoles.some((roleKey) => roleHasPermission(roleKey, permissionKey))) {
    return { allowed: true };
  }

  if (!membership) {
    return { allowed: false, reason: "No project membership was found." };
  }
  return { allowed: false, reason: `Role ${membership.roleKey} does not include ${permissionKey}.` };
}

// Roles assigned to the profile with no project scope (user_role_assignments
// where project_id is null) — platform roles like super_admin.
export async function getGlobalRoleKeys(profileId: string): Promise<string[]> {
  if (profileId.startsWith("development")) return ["super_admin"];
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("user_role_assignments")
    .select("roles(role_key)")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .is("project_id", null);

  const keys: string[] = [];
  for (const row of data || []) {
    const roles = row.roles as { role_key?: string } | { role_key?: string }[] | null;
    const roleKey = Array.isArray(roles) ? roles[0]?.role_key : roles?.role_key;
    if (roleKey) keys.push(roleKey);
  }
  return keys;
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
  const globalRoles = await getGlobalRoleKeys(profileId);
  const memberships = await getUserProjectMemberships(profileId);
  const scoped = projectId ? memberships.filter((membership) => membership.projectId === projectId) : memberships;
  return [...new Set([...globalRoles, ...scoped.map((membership) => membership.roleKey)])];
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
