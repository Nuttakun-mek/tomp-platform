import { cache } from "react";
import type { Mission } from "@tomp/types/domain";
import { withTimeout } from "@/lib/async/timeout";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { resolveReadClient } from "@/lib/supabase/scoped-client";
import { mapMission } from "./mappers";

// cache(): one render often needs this list from several components; keep it to one query per request.
export const getMissionsByProjectId = cache(async function getMissionsByProjectId(projectId: string): Promise<Mission[]> {
  const { client: supabase } = await resolveReadClient();
  if (!supabase) return demoKernel.missions.filter((mission) => mission.projectId === projectId);

  try {
    const { data, error } = await withTimeout(supabase.from("missions").select("*").eq("project_id", projectId).order("planned_start_time"), 2200, "missions");
    if (error || !data) return demoKernel.missions.filter((mission) => mission.projectId === projectId);
    return data.map(mapMission);
  } catch {
    return demoKernel.missions.filter((mission) => mission.projectId === projectId);
  }
});