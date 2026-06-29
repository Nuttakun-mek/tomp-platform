import type { Assignment } from "@tomp/types/domain";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";
import { mapAssignment } from "./mappers";

export async function getAssignmentsByProjectId(projectId: string): Promise<Assignment[]> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return demoKernel.assignments.filter((assignment) => assignment.projectId === projectId);

  const { data, error } = await supabase.from("assignments").select("*").eq("project_id", projectId).order("start_time");
  if (error || !data) return demoKernel.assignments.filter((assignment) => assignment.projectId === projectId);
  return data.map(mapAssignment);
}
