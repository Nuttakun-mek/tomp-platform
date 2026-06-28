import type { Mission } from "@tomp/types/domain";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { mapMission } from "./mappers";

export async function getMissionsByProjectId(projectId: string): Promise<Mission[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return demoKernel.missions.filter((mission) => mission.projectId === projectId);

  const { data, error } = await supabase.from("missions").select("*").eq("project_id", projectId).order("planned_start_time");
  if (error || !data) return demoKernel.missions.filter((mission) => mission.projectId === projectId);
  return data.map(mapMission);
}
