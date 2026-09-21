import { cache } from "react";
import { getPostgresClient } from "@/lib/db/postgres";
import { rowLoose, type Row } from "@/lib/data/row";
import { resolveReadClient } from "@/lib/supabase/scoped-client";

export interface AssignmentStatusUpdate {
  status: string;
  source: string;
  at: string;
}

export interface AssignmentWorkSession {
  status: "not_started" | "active" | "ended";
  startedAt: string | null;
  endedAt: string | null;
  latestAt: string | null;
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

function collapseWorkSessions(rows: Row[]): Record<string, AssignmentWorkSession> {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const id = rowLoose(row, "assignment_id");
    if (!id) continue;
    const list = grouped.get(id) ?? [];
    list.push(row);
    grouped.set(id, list);
  }
  const result: Record<string, AssignmentWorkSession> = {};
  for (const [assignmentId, list] of grouped) {
    const sorted = [...list].sort((a, b) => new Date(rowLoose(b, "created_at")).getTime() - new Date(rowLoose(a, "created_at")).getTime());
    const latest = sorted[0];
    const started = sorted.find((row) => rowLoose(row, "status") === "work_started");
    const ended = sorted.find((row) => rowLoose(row, "status") === "work_ended");
    const status = rowLoose(latest, "status") === "work_started" ? "active" : rowLoose(latest, "status") === "work_ended" ? "ended" : "not_started";
    result[assignmentId] = {
      status,
      startedAt: started ? rowLoose(started, "created_at") : null,
      endedAt: ended ? rowLoose(ended, "created_at") : null,
      latestAt: latest ? rowLoose(latest, "created_at") : null
    };
  }
  return result;
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
      .not("status", "in", '("work_started","work_ended")')
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
        and status not in ('work_started', 'work_ended')
      order by created_at desc
      limit 200
    `;
    return collapse(rows);
  } catch {
    return {};
  }
});

export const getAssignmentWorkSessions = cache(async function getAssignmentWorkSessions(projectId: string): Promise<Record<string, AssignmentWorkSession>> {
  const { client } = await resolveReadClient();
  if (client) {
    const { data, error } = await client
      .from("assignment_status_updates")
      .select("assignment_id, status, created_at")
      .eq("project_id", projectId)
      .in("status", ["work_started", "work_ended"])
      .order("created_at", { ascending: false })
      .limit(500);
    if (!error && data) return collapseWorkSessions(data as Row[]);
  }

  const sql = getPostgresClient();
  if (!sql) return {};
  try {
    const rows = await sql<Row[]>`
      select assignment_id, status, created_at
      from assignment_status_updates
      where project_id = ${projectId}
        and status in ('work_started', 'work_ended')
      order by created_at desc
      limit 500
    `;
    return collapseWorkSessions(rows);
  } catch {
    return {};
  }
});
