// Which role_key values a project.manage_members holder may grant, per system.
//
// This is a security boundary, not a UI convenience: `roles` also contains
// platform-level rows like super_admin, and project_members.role_id has no
// database constraint stopping one of those from being written through a
// project-scoped grant action. Without this allowlist, anyone holding
// project.manage_members on ANY project — even one they created themselves —
// could grant themselves (or anyone) super_admin, because getUserRoles()
// unions every project_members role a profile holds into that profile's
// GLOBAL role set (lib/auth/rbac.ts), and super_admin maps to the "*"
// permission wildcard.
//
// "driver" is deliberately absent from ground_transfer's list even though it
// is a real role_key: a Ground Transfer driver is enrolled through
// CreateDriverForm (ทรัพยากร) and gets a QR tied to a call sign/assignment,
// not a bare project_members grant — allowing it here would create a second,
// disconnected way to produce the same kind of row. Airport Transfer has no
// such separate enrollment path, so airport_driver grants the normal way.
//
// Shared between the server actions that write project_members (which MUST
// enforce this) and the client form that offers role choices (which reuses it
// so the two can never drift) — it holds no secrets and does no I/O, so it is
// safe to import from either side.
export const SYSTEM_ROLE_ALLOWLIST: Record<string, readonly string[]> = {
  ground_transfer: ["project_manager", "dispatcher", "coordinator", "customer_viewer"],
  airport_transfer: ["airport_admin", "airport_dispatcher", "airport_coordinator", "airport_driver", "airport_viewer"]
};

export function isRoleAllowedForSystem(systemKey: string, roleKey: string): boolean {
  return (SYSTEM_ROLE_ALLOWLIST[systemKey] ?? []).includes(roleKey);
}

/** Roles that may manage (not just view) work within a system — used to scope what a granted role can see/do, e.g. on the project-helper claim view. */
export const SYSTEM_MANAGER_ROLES: Record<string, readonly string[]> = {
  ground_transfer: ["project_manager", "dispatcher"],
  airport_transfer: ["airport_admin", "airport_dispatcher"]
};

export function isManagerRoleForSystem(systemKey: string, roleKey: string): boolean {
  return (SYSTEM_MANAGER_ROLES[systemKey] ?? []).includes(roleKey);
}
