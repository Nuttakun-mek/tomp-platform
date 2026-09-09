import { cache } from "react";
import { rowLoose, rowObject, type Row } from "@/lib/data/row";
import { getPostgresClient } from "@/lib/db/postgres";
import { resolveReadClient } from "@/lib/supabase/scoped-client";

export interface ProjectMemberRow {
  profileId: string;
  fullName: string;
  email: string;
  roleKey: string;
  status: string;
}

function mapNested(row: Row): ProjectMemberRow {
  const profile = rowObject(row, "profiles");
  const role = rowObject(row, "roles");
  return {
    profileId: rowLoose(row, "profile_id"),
    fullName: rowLoose(profile, "full_name", "ไม่ทราบชื่อ"),
    email: rowLoose(profile, "email"),
    roleKey: rowLoose(role, "role_key"),
    status: rowLoose(row, "status", "active")
  };
}

function mapFlat(row: Row): ProjectMemberRow {
  return {
    profileId: rowLoose(row, "profile_id"),
    fullName: rowLoose(row, "full_name", "ไม่ทราบชื่อ"),
    email: rowLoose(row, "email"),
    roleKey: rowLoose(row, "role_key"),
    status: rowLoose(row, "status", "active")
  };
}

// cache(): one render often needs this list from several components; keep it to one query per request.
export const getProjectMembers = cache(async function getProjectMembers(projectId: string): Promise<ProjectMemberRow[]> {
  const { client } = await resolveReadClient();
  if (client) {
    const { data, error } = await client
      .from("project_members")
      .select("profile_id, status, profiles(full_name, email), roles(role_key)")
      .eq("project_id", projectId);
    if (!error && data) return (data as Row[]).map(mapNested);
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
    return rows.map(mapFlat);
  } catch {
    return [];
  }
});