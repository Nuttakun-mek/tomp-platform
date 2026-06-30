import type { CallSign } from "@tomp/types/domain";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";
import { mapCallSign } from "./mappers";

export async function getCallSignsByProjectId(projectId: string): Promise<CallSign[]> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return demoKernel.callSigns.filter((callSign) => callSign.projectId === projectId);

  const { data, error } = await supabase.from("call_signs").select("*").eq("project_id", projectId).order("call_sign");
  if (error || !data) return demoKernel.callSigns.filter((callSign) => callSign.projectId === projectId);
  return data.map(mapCallSign);
}
