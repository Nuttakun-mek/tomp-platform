export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ["*"],
  organization_admin: ["project.read", "project.create", "project.update", "mission.read", "assignment.read", "timeline.read", "admin.manage_users"],
  project_manager: ["project.read", "project.update", "project.publish", "mission.read", "mission.create", "assignment.read", "assignment.create", "timeline.read", "timeline.create"],
  operation_manager: ["project.read", "mission.read", "assignment.read", "assignment.update", "driver.read", "vehicle.read", "timeline.read", "timeline.create"],
  planner: ["project.read", "mission.read", "mission.create", "mission.update", "assignment.read", "assignment.create"],
  dispatcher: ["project.read", "mission.read", "assignment.read", "assignment.create", "assignment.update", "driver.read", "vehicle.read"],
  coordinator: ["project.read", "mission.read", "assignment.read", "timeline.read"],
  driver: ["assignment.read"],
  organizer: ["project.read", "mission.read", "timeline.read"],
  customer_viewer: ["project.read", "timeline.read"],
  vendor: ["assignment.read", "driver.read", "vehicle.read"]
};

export function hasPermission(roleKey: string, permissionKey: string): boolean {
  const permissions = ROLE_PERMISSIONS[roleKey] || [];
  return permissions.includes("*") || permissions.includes(permissionKey);
}

