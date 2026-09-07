import type { TimelineEvent } from "@tomp/types/domain";
import { withTimeout } from "@/lib/async/timeout";
import { getPostgresClient } from "@/lib/db/postgres";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";
import { mapTimelineEvent } from "./mappers";

export async function getTimelineEventsByProjectId(projectId: string): Promise<TimelineEvent[]> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return getTimelineEventsByProjectIdViaPostgres(projectId);

  try {
    const { data, error } = await withTimeout(supabase.from("timeline_events").select("*").eq("project_id", projectId).order("created_at", { ascending: false }), 2200, "timeline events");
    if (error || !data) return getTimelineEventsByProjectIdViaPostgres(projectId);
    return data.map(mapTimelineEvent);
  } catch {
    return getTimelineEventsByProjectIdViaPostgres(projectId);
  }
}

async function getTimelineEventsByProjectIdViaPostgres(projectId: string): Promise<TimelineEvent[]> {
  const sql = getPostgresClient();
  if (!sql) return demoKernel.timelineEvents.filter((event) => event.projectId === projectId);
  try {
    const data = await sql<Array<Record<string, unknown>>>`select * from timeline_events where project_id = ${projectId} order by created_at desc limit 100`;
    return data.length ? data.map(mapTimelineEvent) : demoKernel.timelineEvents.filter((event) => event.projectId === projectId);
  } catch {
    return demoKernel.timelineEvents.filter((event) => event.projectId === projectId);
  }
}
