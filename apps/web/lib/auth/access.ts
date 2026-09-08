import "server-only";

import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/auth/current-user";
import { loadRolePermissions, permissionsForRoles } from "@/lib/auth/permissions";
import { getUserRoles } from "@/lib/auth/rbac";
import { resolvePrimaryRole } from "@/lib/auth/role-model";

export interface ViewerAccess {
  profile: CurrentUserProfile;
  roleKeys: string[];
  permissions: string[];
  primaryRole: string | null;
}

export async function getViewerAccess(): Promise<ViewerAccess> {
  const profile = await getCurrentUserProfile();

  // dev fallback: full access, super_admin
  if (profile.isDevelopmentFallback) {
    return { profile, roleKeys: ["super_admin"], permissions: ["*"], primaryRole: "super_admin" };
  }

  if (!profile.authUserId || profile.id === "anonymous") {
    return { profile, roleKeys: [], permissions: [], primaryRole: null };
  }

  const [roleKeys, matrix] = await Promise.all([getUserRoles(profile.id), loadRolePermissions()]);
  const permissions = permissionsForRoles(roleKeys, matrix);
  return { profile, roleKeys, permissions, primaryRole: resolvePrimaryRole(roleKeys) };
}
