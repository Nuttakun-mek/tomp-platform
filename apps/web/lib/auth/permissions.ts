export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ["*"],
  organization_admin: ["project.read", "project.create", "project.update", "mission.read", "assignment.read", "timeline.read", "admin.manage_users"],
  project_manager: ["project.read", "project.create", "project.update", "project.publish", "mission.read", "mission.create", "mission.update", "assignment.read", "assignment.create", "assignment.update", "driver.read", "driver.create", "driver.update", "vehicle.read", "vehicle.create", "vehicle.update", "timeline.read", "timeline.create", "change.create", "change.approve", "change.apply"],
  operation_manager: ["project.read", "mission.read", "assignment.read", "assignment.update", "driver.read", "driver.update", "vehicle.read", "vehicle.update", "timeline.read", "timeline.create", "change.create", "change.apply"],
  planner: ["project.read", "mission.read", "mission.create", "mission.update", "assignment.read", "assignment.create"],
  dispatcher: ["project.read", "mission.read", "assignment.read", "assignment.create", "assignment.update", "driver.read", "driver.create", "vehicle.read", "vehicle.create"],
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
