import type { TimelineEvent } from "@tomp/types/domain";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { mapTimelineEvent } from "./mappers";

export async function getTimelineEventsByProjectId(projectId: string): Promise<TimelineEvent[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return demoKernel.timelineEvents.filter((event) => event.projectId === projectId);

  const { data, error } = await supabase.from("timeline_events").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  if (error || !data) return demoKernel.timelineEvents.filter((event) => event.projectId === projectId);
  return data.map(mapTimelineEvent);
}
