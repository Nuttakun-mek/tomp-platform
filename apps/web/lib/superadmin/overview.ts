import "server-only";

import { getSupabaseServerDataClient } from "@/lib/supabase/server";

type PermRow = { role_key: string; permission_key: string };

export interface RoleMatrix {
  roles: string[];
  permissions: string[];
  grid: Record<string, string[]>;
}

// Pure: turn flat (role, permission) pairs into a sorted matrix.
export function buildRoleMatrix(rows: PermRow[]): { roles: string[]; permissions: string[]; grid: Record<string, Set<string>> } {
  const roleSet = new Set<string>();
  const permSet = new Set<string>();
  const grid: Record<string, Set<string>> = {};

  for (const row of rows) {
    if (!row?.role_key || !row?.permission_key) continue;
    roleSet.add(row.role_key);
    permSet.add(row.permission_key);
    (grid[row.role_key] ||= new Set<string>()).add(row.permission_key);
  }

  return {
    roles: [...roleSet].sort(),
    permissions: [...permSet].sort(),
    grid
  };
}

function joinValue(value: unknown, key: string): string | null {
  const node = Array.isArray(value) ? value[0] : value;
  const inner = node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined;
  return typeof inner === "string" ? inner : null;
}

export async function listRolePermissionMatrix(): Promise<RoleMatrix> {
  const client = getSupabaseServerDataClient();
  if (!client) return { roles: [], permissions: [], grid: {} };

  const { data } = await client.from("role_permissions").select("roles(role_key), permissions(permission_key)");
  const rows: PermRow[] = ((data || []) as Array<Record<string, unknown>>)
    .map((row) => ({
      role_key: joinValue(row.roles, "role_key") || "",
      permission_key: joinValue(row.permissions, "permission_key") || ""
    }))
    .filter((row) => row.role_key && row.permission_key);

  const matrix = buildRoleMatrix(rows);
  const grid: Record<string, string[]> = {};
  for (const [role, perms] of Object.entries(matrix.grid)) grid[role] = [...perms].sort();
  return { roles: matrix.roles, permissions: matrix.permissions, grid };
}

export interface OrgRow {
  id: string;
  name: string;
  status: string;
  projectCount: number;
  memberCount: number;
}

export async function listOrganizationsWithCounts(): Promise<OrgRow[]> {
  const client = getSupabaseServerDataClient();
  if (!client) return [];

  const [{ data: orgs }, { data: projects }, { data: profiles }] = await Promise.all([
    client.from("organizations").select("id, name, status").order("name"),
    client.from("projects").select("id, organization_id"),
    client.from("profiles").select("id, organization_id")
  ]);

  const projectsByOrg = new Map<string, number>();
  for (const project of (projects || []) as Array<Record<string, unknown>>) {
    const org = String(project.organization_id ?? "");
    if (org) projectsByOrg.set(org, (projectsByOrg.get(org) || 0) + 1);
  }
  const membersByOrg = new Map<string, number>();
  for (const profile of (profiles || []) as Array<Record<string, unknown>>) {
    const org = String(profile.organization_id ?? "");
    if (org) membersByOrg.set(org, (membersByOrg.get(org) || 0) + 1);
  }

  return ((orgs || []) as Array<Record<string, unknown>>).map((org) => {
    const id = String(org.id);
    return {
      id,
      name: String(org.name ?? "องค์กรไม่มีชื่อ"),
      status: String(org.status ?? "unknown"),
      projectCount: projectsByOrg.get(id) || 0,
      memberCount: membersByOrg.get(id) || 0
    };
  });
}

export interface AdminProjectRow {
  id: string;
  projectCode: string;
  projectName: string;
  status: string;
  organizationName: string;
  memberCount: number;
  ownerName: string | null;
}

export async function listAllProjects(): Promise<AdminProjectRow[]> {
  const client = getSupabaseServerDataClient();
  if (!client) return [];

  const [{ data: projects }, { data: members }, { data: profiles }, { data: orgs }] = await Promise.all([
    client.from("projects").select("id, project_code, project_name, status, organization_id, owner_profile_id").order("created_at", { ascending: false }),
    client.from("project_members").select("project_id, status"),
    client.from("profiles").select("id, full_name"),
    client.from("organizations").select("id, name")
  ]);

  const membersByProject = new Map<string, number>();
  for (const member of (members || []) as Array<Record<string, unknown>>) {
    if (String(member.status ?? "") !== "active") continue;
    const project = String(member.project_id ?? "");
    if (project) membersByProject.set(project, (membersByProject.get(project) || 0) + 1);
  }
  const nameByProfile = new Map<string, string>();
  for (const profile of (profiles || []) as Array<Record<string, unknown>>) {
    nameByProfile.set(String(profile.id), String(profile.full_name ?? ""));
  }
  const nameByOrg = new Map<string, string>();
  for (const org of (orgs || []) as Array<Record<string, unknown>>) {
    nameByOrg.set(String(org.id), String(org.name ?? ""));
  }

  return ((projects || []) as Array<Record<string, unknown>>).map((project) => {
    const id = String(project.id);
    const ownerId = project.owner_profile_id ? String(project.owner_profile_id) : null;
    return {
      id,
      projectCode: String(project.project_code ?? ""),
      projectName: String(project.project_name ?? ""),
      status: String(project.status ?? "unknown"),
      organizationName: nameByOrg.get(String(project.organization_id ?? "")) || "ไม่ทราบองค์กร",
      memberCount: membersByProject.get(id) || 0,
      ownerName: ownerId ? nameByProfile.get(ownerId) || null : null
    };
  });
}

export interface AuditRow {
  id: string;
  projectName: string;
  eventType: string;
  objectType: string;
  actorName: string | null;
  reason: string | null;
  createdAt: string;
}

export async function listRecentAuditEvents(limit = 100): Promise<AuditRow[]> {
  const client = getSupabaseServerDataClient();
  if (!client) return [];

  const { data: events } = await client
    .from("timeline_events")
    .select("id, event_type, object_type, actor_id, reason, created_at, project_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (events || []) as Array<Record<string, unknown>>;
  const projectIds = [...new Set(rows.map((row) => String(row.project_id ?? "")).filter(Boolean))];
  const actorIds = [...new Set(rows.map((row) => (row.actor_id ? String(row.actor_id) : "")).filter(Boolean))];

  const [{ data: projects }, { data: profiles }] = await Promise.all([
    projectIds.length ? client.from("projects").select("id, project_name").in("id", projectIds) : Promise.resolve({ data: [] }),
    actorIds.length ? client.from("profiles").select("id, full_name").in("id", actorIds) : Promise.resolve({ data: [] })
  ]);

  const nameByProject = new Map<string, string>();
  for (const project of (projects || []) as Array<Record<string, unknown>>) {
    nameByProject.set(String(project.id), String(project.project_name ?? ""));
  }
  const nameByActor = new Map<string, string>();
  for (const profile of (profiles || []) as Array<Record<string, unknown>>) {
    nameByActor.set(String(profile.id), String(profile.full_name ?? ""));
  }

  return rows.map((row) => ({
    id: String(row.id),
    projectName: nameByProject.get(String(row.project_id ?? "")) || "ไม่ทราบโครงการ",
    eventType: String(row.event_type ?? ""),
    objectType: String(row.object_type ?? ""),
    actorName: row.actor_id ? nameByActor.get(String(row.actor_id)) || null : null,
    reason: typeof row.reason === "string" && row.reason.trim() ? row.reason : null,
    createdAt: String(row.created_at ?? "")
  }));
}
