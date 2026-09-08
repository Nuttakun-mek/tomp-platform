// Fallback matrix — must stay in sync with database/migrations/0018_seed_role_permissions.sql.
// The DB (role_permissions) is the source of truth; this is used only when the DB
// is unreachable (see loadRolePermissions).
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ["*"],
  organization_admin: [
    "project.read",
    "project.create",
    "project.update",
    "mission.read",
    "assignment.read",
    "timeline.read",
    "admin.manage_users",
    "org.manage"
  ],
  project_manager: [
    "project.read",
    "project.create",
    "project.update",
    "project.publish",
    "mission.read",
    "mission.create",
    "mission.update",
    "assignment.read",
    "assignment.create",
    "assignment.update",
    "driver.read",
    "driver.create",
    "driver.update",
    "vehicle.read",
    "vehicle.create",
    "vehicle.update",
    "timeline.read",
    "timeline.create",
    "change.create",
    "change.approve",
    "change.apply",
    "incident.create",
    "incident.manage",
    "recovery.manage"
  ],
  operation_manager: [
    "project.read",
    "mission.read",
    "assignment.read",
    "assignment.update",
    "driver.read",
    "driver.update",
    "vehicle.read",
    "vehicle.update",
    "timeline.read",
    "timeline.create",
    "change.create",
    "change.apply",
    "incident.create",
    "incident.manage",
    "recovery.manage"
  ],
  planner: ["project.read", "mission.read", "mission.create", "mission.update", "assignment.read", "assignment.create"],
  dispatcher: [
    "project.read",
    "mission.read",
    "assignment.read",
    "assignment.create",
    "assignment.update",
    "driver.read",
    "driver.create",
    "vehicle.read",
    "vehicle.create"
  ],
  coordinator: ["project.read", "mission.read", "assignment.read", "timeline.read", "incident.create"],
  driver: ["assignment.read"],
  organizer: ["project.read", "mission.read", "timeline.read", "change.create"],
  customer_viewer: ["project.read", "timeline.read"],
  vendor: ["assignment.read", "driver.read", "vehicle.read"]
};

// Permissions that are NOT project-scoped — they are granted by a global or
// org-level role (user_role_assignments), never by project_members. requirePermission
// must route these to the global-role check even when a project/org id is supplied.
export const GLOBAL_PERMISSIONS = new Set(["project.create", "admin.manage_users", "org.manage", "superadmin.access"]);

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
export async function loadRolePermissions(): Promise<Record<string, string[]>> {
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
}
