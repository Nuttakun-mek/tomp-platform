import type { CallSign } from "@tomp/types/domain";
import { withTimeout } from "@/lib/async/timeout";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";
import { mapCallSign } from "./mappers";

export async function getCallSignsByProjectId(projectId: string): Promise<CallSign[]> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return demoKernel.callSigns.filter((callSign) => callSign.projectId === projectId);

  try {
    const { data, error } = await withTimeout(supabase.from("call_signs").select("*").eq("project_id", projectId).order("call_sign"), 2200, "call signs");
    if (error || !data) return demoKernel.callSigns.filter((callSign) => callSign.projectId === projectId);
    return data.map(mapCallSign);
  } catch {
    return demoKernel.callSigns.filter((callSign) => callSign.projectId === projectId);
  }
}
