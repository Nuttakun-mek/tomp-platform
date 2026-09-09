import { cache } from "react";
import type { TimelineEvent } from "@tomp/types/domain";
import { type DataResult, runListQuery } from "@/lib/data/data-result";
import { getPostgresClient } from "@/lib/db/postgres";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { demoOr } from "@/lib/data/demo-fallback";
import { resolveReadClient } from "@/lib/supabase/scoped-client";
import { mapTimelineEvent } from "./mappers";

// cache(): one render often needs this list from several components; keep it to one query per request.
export const getTimelineEventsByProjectId = cache(async function getTimelineEventsByProjectId(
  projectId: string
): Promise<DataResult<TimelineEvent[]>> {
  const { client: supabase } = await resolveReadClient();
  if (!supabase) return { ok: true, data: await getTimelineEventsByProjectIdViaPostgres(projectId) };

  return runListQuery({
    fallback: [],
    label: "timeline events",
    query: () => supabase.from("timeline_events").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    map: (rows) => rows.map(mapTimelineEvent)
  });
});
async function getTimelineEventsByProjectIdViaPostgres(projectId: string): Promise<TimelineEvent[]> {
  const sql = getPostgresClient();
  if (!sql) return demoOr(demoKernel.timelineEvents.filter((event) => event.projectId === projectId), []);
  try {
    const data = await sql<Array<Record<string, unknown>>>`select * from timeline_events where project_id = ${projectId} order by created_at desc limit 100`;
    return data.length ? data.map(mapTimelineEvent) : demoOr(demoKernel.timelineEvents.filter((event) => event.projectId === projectId), []);
  } catch {
    return demoOr(demoKernel.timelineEvents.filter((event) => event.projectId === projectId), []);
  }
}
