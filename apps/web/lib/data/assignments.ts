import type { Assignment } from "@tomp/types/domain";
import { getPostgresClient } from "@/lib/db/postgres";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";
import { mapAssignment } from "./mappers";

export async function getAssignmentsByProjectId(projectId: string): Promise<Assignment[]> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return getAssignmentsByProjectIdViaPostgres(projectId);

  const { data, error } = await supabase.from("assignments").select("*").eq("project_id", projectId).order("start_time");
  if (error || !data) return getAssignmentsByProjectIdViaPostgres(projectId);
  return data.map(mapAssignment);
}

async function getAssignmentsByProjectIdViaPostgres(projectId: string): Promise<Assignment[]> {
  const sql = getPostgresClient();
  if (!sql) return demoKernel.assignments.filter((assignment) => assignment.projectId === projectId);
  try {
    const data = await sql<Array<Record<string, unknown>>>`select * from assignments where project_id = ${projectId} order by start_time nulls last, created_at desc`;
    return data.length ? data.map(mapAssignment) : demoKernel.assignments.filter((assignment) => assignment.projectId === projectId);
  } catch {
    return demoKernel.assignments.filter((assignment) => assignment.projectId === projectId);
  }
}
