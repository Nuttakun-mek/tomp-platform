import { cache } from "react";

// Fallback matrix — must stay in sync with the latest role_permissions seed
// (database/migrations/0021_rbac_v3_single_org.sql). The DB is the source of truth;
// this is used only when the DB is unreachable (see loadRolePermissions).
//
// Single-org model: super_admin (platform) + 4 per-project roles. `driver` is the
// QR flow only. Legacy roles (organization_admin, operation_manager, planner, vendor,
// organizer) intentionally carry no permissions.
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ["*"],
  project_manager: [
    "project.read",
    "project.create",
    "project.update",
    "project.publish",
    "mission.read",
    "mission.create",
    "assignment.read",
    "assignment.create",
    "assignment.update",
    "driver.read",
    "vehicle.read",
    "timeline.read",
    "change.create"
  ],
  dispatcher: [
    "project.read",
    "mission.read",
    "assignment.read",
    "assignment.create",
    "assignment.update",
    "driver.read",
    "vehicle.read",
    "timeline.read"
  ],
  coordinator: ["project.read", "mission.read", "assignment.read", "timeline.read"],
  customer_viewer: ["project.read", "mission.read", "timeline.read", "change.create"],
  driver: []
};

// Permissions that are NOT project-scoped — they are granted by a global or
// org-level role (user_role_assignments), never by project_members. requirePermission
// must route these to the global-role check even when a project/org id is supplied.
export const GLOBAL_PERMISSIONS = new Set(["project.create", "admin.manage_users", "superadmin.access"]);

export function isGlobalPermission(permissionKey: string): boolean {
  return GLOBAL_PERMISSIONS.has(permissionKey);
}

export function roleHasPermission(roleKey: string, permissionKey: string): boolean {
  const permissions = ROLE_PERMISSIONS[roleKey] || [];
  return permissions.includes("*") || permissions.includes(permissionKey);
}

export const hasPermissionForRole = roleHasPermission;

export function permissionsForRoles(roleKeys: string[], matrix: Record<string, string[]> = ROLE_PERMISSIONS): string[] {
  const out = new Set<string>();
  for (const roleKey of roleKeys) {
    for (const perm of matrix[roleKey] || []) out.add(perm);
  }
  return [...out];
}

// อ่าน role_permissions จาก DB; ใช้ fallback map ถ้าอ่านไม่ได้/ว่าง
// cache(): the permission matrix is identical for the whole request.
export const loadRolePermissions = cache(async function loadRolePermissions(): Promise<Record<string, string[]>> {
  try {
    const { getSupabaseServerDataClient } = await import("@/lib/supabase/server");
    const client = getSupabaseServerDataClient();
    if (!client) return ROLE_PERMISSIONS;

    const { data, error } = await client
      .from("role_permissions")
      .select("roles(role_key), permissions(permission_key)");

    if (error || !data?.length) return ROLE_PERMISSIONS;

    const matrix: Record<string, string[]> = {};
    for (const row of data as Array<Record<string, unknown>>) {
      const roleKey = (row.roles as { role_key?: string } | null)?.role_key;
      const permKey = (row.permissions as { permission_key?: string } | null)?.permission_key;
      if (!roleKey || !permKey) continue;
      (matrix[roleKey] ||= []).push(permKey);
    }
    return Object.keys(matrix).length ? matrix : ROLE_PERMISSIONS;
  } catch {
    return ROLE_PERMISSIONS;
  }
});
