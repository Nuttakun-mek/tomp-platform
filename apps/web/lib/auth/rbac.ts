import "server-only";

import { getProjectMembership } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";

export async function requirePermission(projectId: string, permissionKey: string): Promise<{ allowed: boolean; reason?: string }> {
  const membership = await getProjectMembership(projectId);

  if (!membership) {
    return { allowed: false, reason: "No project membership was found." };
  }

  if (!hasPermission(membership.roleKey, permissionKey)) {
    return { allowed: false, reason: `Role ${membership.roleKey} does not include ${permissionKey}.` };
  }

  return { allowed: true };
}

export async function getUserProjectScope(projectId: string): Promise<{ projectId: string; roleKey: string; permissions: string[]; isDevelopmentFallback: boolean } | null> {
  const membership = await getProjectMembership(projectId);
  if (!membership) return null;

  return {
    projectId: membership.projectId,
    roleKey: membership.roleKey,
    permissions: membership.permissions,
    isDevelopmentFallback: membership.isDevelopmentFallback
  };
}

