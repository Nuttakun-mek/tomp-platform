import { cache } from "react";
import { getPostgresClient } from "@/lib/db/postgres";
import { rowLoose, type Row } from "@/lib/data/row";
import { resolveReadClient } from "@/lib/supabase/scoped-client";

export interface AssignmentStatusUpdate {
  status: string;
  source: string;
  at: string;
}

function collapse(rows: Row[]): Record<string, AssignmentStatusUpdate> {
  const latest: Record<string, AssignmentStatusUpdate> = {};
  for (const row of rows) {
    const id = rowLoose(row, "assignment_id");
    if (!id || latest[id]) continue;
    latest[id] = {
      status: rowLoose(row, "status", "unknown"),
      source: rowLoose(row, "source", "driver_qr"),
      at: rowLoose(row, "created_at")
    };
  }
  return latest;
}

// Latest driver-reported status per assignment, straight from
// assignment_status_updates (mission control was only inferring status from GPS
// ping metadata before, so a status change without a ping never showed up).
// cache(): one render often needs this list from several components; keep it to one query per request.
export const getLatestAssignmentStatuses = cache(async function getLatestAssignmentStatuses(projectId: string): Promise<Record<string, AssignmentStatusUpdate>> {
  const { client } = await resolveReadClient();
  if (client) {
    const { data, error } = await client
      .from("assignment_status_updates")
      .select("assignment_id, status, source, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) return collapse(data as Row[]);
  }

  const sql = getPostgresClient();
  if (!sql) return {};
  try {
    const rows = await sql<Row[]>`
      select assignment_id, status, source, created_at
      from assignment_status_updates
      where project_id = ${projectId}
      order by created_at desc
      limit 200
    `;
    return collapse(rows);
  } catch {
    return {};
  }
});