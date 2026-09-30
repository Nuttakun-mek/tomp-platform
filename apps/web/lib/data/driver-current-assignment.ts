import "server-only";

import { getPostgresClient } from "@/lib/db/postgres";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { pickCurrentJob } from "@/lib/domain/driver-current-job";

type Row = Record<string, unknown>;

function text(row: Row | null | undefined, key: string): string {
  return typeof row?.[key] === "string" ? row[key] : "";
}

// postgres.js hands timestamps back as Date, supabase-js as strings.
function iso(row: Row, key: string): string | null {
  const value = row[key];
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" && value ? value : null;
}

function pick(rows: Row[]) {
  const jobs = rows.map((row) => ({ id: text(row, "id"), status: text(row, "status"), startTime: iso(row, "start_time"), createdAt: iso(row, "created_at"), row }));
  return pickCurrentJob(jobs)?.row;
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
      return toCurrent(pick(rows));
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
  `;
  return toCurrent(pick(rows));
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
