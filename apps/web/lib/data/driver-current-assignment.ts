import "server-only";

import { getPostgresClient } from "@/lib/db/postgres";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

type Row = Record<string, unknown>;

const RANK: Record<string, number> = {
  active: 0,
  acknowledged: 1,
  ready: 2,
  published: 3,
  planned: 4,
  draft: 5,
  parked: 6,
  completed: 7,
  cancelled: 8,
  archived: 9
};

function text(row: Row | null | undefined, key: string): string {
  return typeof row?.[key] === "string" ? row[key] : "";
}

function rank(row: Row) {
  return RANK[text(row, "status")] ?? 99;
}

function byOperationalOrder(a: Row, b: Row) {
  const rankDelta = rank(a) - rank(b);
  if (rankDelta !== 0) return rankDelta;
  const aStart = Date.parse(text(a, "start_time"));
  const bStart = Date.parse(text(b, "start_time"));
  if (Number.isFinite(aStart) && Number.isFinite(bStart) && aStart !== bStart) return aStart - bStart;
  if (Number.isFinite(aStart)) return -1;
  if (Number.isFinite(bStart)) return 1;
  return text(a, "created_at").localeCompare(text(b, "created_at"));
}

export interface DriverCurrentAssignmentScope {
  projectId: string;
  assignmentId?: string | null;
  callSignId?: string | null;
  driverId: string;
}

export interface DriverCurrentAssignment {
  id: string;
  projectId: string;
  callSignId: string;
  driverId: string | null;
  vehicleId: string | null;
  status: string;
}

function toCurrent(row: Row | null | undefined): DriverCurrentAssignment | null {
  if (!row) return null;
  const id = text(row, "id");
  const projectId = text(row, "project_id");
  const callSignId = text(row, "call_sign_id");
  if (!id || !projectId || !callSignId) return null;
  return {
    id,
    projectId,
    callSignId,
    driverId: text(row, "driver_id") || null,
    vehicleId: text(row, "vehicle_id") || null,
    status: text(row, "status") || "planned"
  };
}

export async function resolveDriverCurrentAssignment(scope: DriverCurrentAssignmentScope): Promise<DriverCurrentAssignment | null> {
  if (scope.callSignId) {
    const byCallSign = await resolveByCallSign(scope.projectId, scope.callSignId, scope.driverId);
    if (byCallSign) return byCallSign;
  }
  if (scope.assignmentId) {
    return resolveByAssignment(scope.projectId, scope.assignmentId, scope.driverId);
  }
  return null;
}

async function resolveByCallSign(projectId: string, callSignId: string, driverId: string): Promise<DriverCurrentAssignment | null> {
  const { client } = getSupabaseWriteClient();
  if (client) {
    const { data, error } = await client
      .from("assignments")
      .select("id, project_id, call_sign_id, driver_id, vehicle_id, status, start_time, created_at")
      .eq("project_id", projectId)
      .eq("call_sign_id", callSignId)
      .neq("status", "cancelled");
    if (!error && data?.length) {
      const rows = (data as Row[]).filter((row) => {
        const rowDriver = text(row, "driver_id");
        return !rowDriver || rowDriver === driverId;
      });
      return toCurrent(rows.sort(byOperationalOrder)[0]);
    }
  }

  const sql = getPostgresClient();
  if (!sql) return null;
  const rows = await sql<Row[]>`
    select id, project_id, call_sign_id, driver_id, vehicle_id, status, start_time, created_at
    from assignments
    where project_id = ${projectId}
      and call_sign_id = ${callSignId}
      and status <> 'cancelled'
      and (driver_id is null or driver_id = ${driverId})
    order by
      case status
        when 'active' then 0
        when 'acknowledged' then 1
        when 'ready' then 2
        when 'published' then 3
        when 'planned' then 4
        when 'draft' then 5
        when 'parked' then 6
        when 'completed' then 7
        when 'archived' then 9
        else 99
      end,
      start_time asc nulls last,
      created_at asc
    limit 1
  `;
  return toCurrent(rows[0]);
}

async function resolveByAssignment(projectId: string, assignmentId: string, driverId: string): Promise<DriverCurrentAssignment | null> {
  const { client } = getSupabaseWriteClient();
  if (client) {
    const { data, error } = await client
      .from("assignments")
      .select("id, project_id, call_sign_id, driver_id, vehicle_id, status")
      .eq("project_id", projectId)
      .eq("id", assignmentId)
      .maybeSingle();
    if (!error && data) {
      const row = data as Row;
      const rowDriver = text(row, "driver_id");
      if (rowDriver && rowDriver !== driverId) return null;
      return toCurrent(row);
    }
  }

  const sql = getPostgresClient();
  if (!sql) return null;
  const rows = await sql<Row[]>`
    select id, project_id, call_sign_id, driver_id, vehicle_id, status
    from assignments
    where project_id = ${projectId}
      and id = ${assignmentId}
      and (driver_id is null or driver_id = ${driverId})
    limit 1
  `;
  return toCurrent(rows[0]);
}
