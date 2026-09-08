import { resolveReadClient } from "@/lib/supabase/scoped-client";
import { getPostgresClient } from "@/lib/db/postgres";

export interface ProjectMemberRow {
  profileId: string;
  fullName: string;
  email: string;
  roleKey: string;
  status: string;
}

type Row = Record<string, unknown>;

function map(row: Row): ProjectMemberRow {
  const profile = (row.profiles ?? {}) as Row;
  const role = (row.roles ?? {}) as Row;
  return {
    profileId: String(row.profile_id ?? ""),
    fullName: String(profile.full_name ?? "ไม่ทราบชื่อ"),
    email: String(profile.email ?? ""),
    roleKey: String(role.role_key ?? ""),
    status: String(row.status ?? "active")
  };
}

export async function getProjectMembers(projectId: string): Promise<ProjectMemberRow[]> {
  const { client } = await resolveReadClient();
  if (client) {
    const { data, error } = await client
      .from("project_members")
      .select("profile_id, status, profiles(full_name, email), roles(role_key)")
      .eq("project_id", projectId);
    if (!error && data) return (data as Row[]).map(map);
  }

  const sql = getPostgresClient();
  if (!sql) return [];
  try {
    const rows = await sql<Row[]>`
      select pm.profile_id, pm.status, p.full_name, p.email, r.role_key
      from project_members pm
      left join profiles p on p.id = pm.profile_id
      left join roles r on r.id = pm.role_id
      where pm.project_id = ${projectId}
    `;
    return rows.map((row) => ({
      profileId: String(row.profile_id ?? ""),
      fullName: String(row.full_name ?? "ไม่ทราบชื่อ"),
      email: String(row.email ?? ""),
      roleKey: String(row.role_key ?? ""),
      status: String(row.status ?? "active")
    }));
  } catch {
    return [];
  }
}
