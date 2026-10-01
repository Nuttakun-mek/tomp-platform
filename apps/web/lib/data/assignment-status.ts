import { cache } from "react";
import { getPostgresClient } from "@/lib/db/postgres";
import { rowLoose, type Row } from "@/lib/data/row";
import { inWorkDay, workDayWindow } from "@/lib/domain/work-day";
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
      // A clock-out from before the latest clock-in belongs to an earlier session.
      endedAt: ended && (!started || Date.parse(rowLoose(ended, "created_at")) >= Date.parse(rowLoose(started, "created_at"))) ? rowLoose(ended, "created_at") : null,
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

// A clock-in belongs to the driver's working day, not to one job — the driver
// app reads it that way (lib/data/driver-access.ts), so the control room must
// too, or the second job of a day shows "ยังไม่บันทึกเวลาเข้า" while the driver
// is plainly working. A job with no clock-in rows of its own takes its driver's
// rows from the job's own working day (lib/domain/work-day.ts), if the job is
// still open — never yesterday's unclosed clock-in for this morning's job.
// Jobs keep their own rows where they have them.
const CLOSED_JOB = new Set(["completed", "cancelled", "archived"]);

export function withDriverShifts(rows: Row[], jobs: Row[], now = Date.now()): Record<string, AssignmentWorkSession> {
  const byAssignment = collapseWorkSessions(rows);
  const byDriver = new Map<string, Row[]>();
  for (const row of rows) {
    const driverId = rowLoose(row, "driver_id");
    if (!driverId) continue;
    byDriver.set(driverId, [...(byDriver.get(driverId) ?? []), row]);
  }
  for (const job of jobs) {
    const id = rowLoose(job, "id");
    const driverId = rowLoose(job, "driver_id");
    if (!id || !driverId || byAssignment[id] || CLOSED_JOB.has(rowLoose(job, "status"))) continue;
    const day = workDayWindow(rowLoose(job, "start_time") || null, new Date(now));
    const list = (byDriver.get(driverId) ?? []).filter((row) => inWorkDay(rowLoose(row, "created_at"), day));
    if (!list.length) continue;
    // Collapse the driver's rows for that day as if they were one job.
    const shift = collapseWorkSessions(list.map((row) => ({ ...row, assignment_id: driverId })))[driverId];
    if (shift) byAssignment[id] = shift;
  }
  return byAssignment;
}

export const getAssignmentWorkSessions = cache(async function getAssignmentWorkSessions(projectId: string): Promise<Record<string, AssignmentWorkSession>> {
  const { client } = await resolveReadClient();
  if (client) {
    const [{ data, error }, { data: jobs }] = await Promise.all([
      client
        .from("assignment_status_updates")
        .select("assignment_id, driver_id, status, created_at")
        .eq("project_id", projectId)
        .in("status", ["work_started", "work_ended"])
        .order("created_at", { ascending: false })
        .limit(500),
      client.from("assignments").select("id, driver_id, status, start_time").eq("project_id", projectId)
    ]);
    if (!error && data) return withDriverShifts(data as Row[], (jobs || []) as Row[]);
  }

  const sql = getPostgresClient();
  if (!sql) return {};
  try {
    const [rows, jobs] = await Promise.all([
      sql<Row[]>`
        select assignment_id, driver_id, status, created_at
        from assignment_status_updates
        where project_id = ${projectId}
          and status in ('work_started', 'work_ended')
        order by created_at desc
        limit 500
      `,
      sql<Row[]>`select id, driver_id, status, start_time from assignments where project_id = ${projectId}`
    ]);
    return withDriverShifts(rows, jobs);
  } catch {
    return {};
  }
});
