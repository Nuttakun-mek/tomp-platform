// เรียงจากสิทธิ์สูงสุด → ต่ำสุด; ตัวแรกที่ user มี = primary role
// Single-org model: platform admin + 4 per-project roles. driver = QR flow only.
export const PRIMARY_ROLE_ORDER = ["super_admin", "project_manager", "dispatcher", "coordinator", "customer_viewer", "driver"] as const;

export type PrimaryRole = (typeof PRIMARY_ROLE_ORDER)[number];

const REDIRECT_BY_ROLE: Record<string, string> = {
  super_admin: "/projects", // เลือกโครงการก่อน (project-centric)
  project_manager: "/projects",
  dispatcher: "/projects",
  coordinator: "/projects",
  customer_viewer: "/portal"
  // driver ไม่ redirect ผ่าน callback (ใช้ QR) — ตกไป /no-access ถ้า login ปกติ
};

export function resolvePrimaryRole(roleKeys: string[]): string | null {
  for (const role of PRIMARY_ROLE_ORDER) {
    if (roleKeys.includes(role)) return role;
  }
  return null;
}

export function resolveRedirectPath(primaryRole: string | null): string {
  if (!primaryRole) return "/no-access";
  return REDIRECT_BY_ROLE[primaryRole] ?? "/no-access";
}
