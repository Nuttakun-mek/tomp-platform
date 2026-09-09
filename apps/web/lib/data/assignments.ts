import { cache } from "react";
import type { Assignment } from "@tomp/types/domain";
import { withTimeout } from "@/lib/async/timeout";
import { getPostgresClient } from "@/lib/db/postgres";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { resolveReadClient } from "@/lib/supabase/scoped-client";
import { mapAssignment } from "./mappers";

// cache(): one render often needs this list from several components; keep it to one query per request.
export const getAssignmentsByProjectId = cache(async function getAssignmentsByProjectId(projectId: string): Promise<Assignment[]> {
  const { client: supabase } = await resolveReadClient();
  if (!supabase) return getAssignmentsByProjectIdViaPostgres(projectId);

  try {
    const { data, error } = await withTimeout(supabase.from("assignments").select("*").eq("project_id", projectId).order("start_time"), 2200, "assignments");
    if (error || !data) return getAssignmentsByProjectIdViaPostgres(projectId);
    return data.map(mapAssignment);
  } catch {
    return getAssignmentsByProjectIdViaPostgres(projectId);
  }
});
// One query for several projects. The vehicle-operations aggregation used to
// call getAssignmentsByProjectId once per project (N+1). Not cache()-wrapped:
// the array argument would never hit an identity key.
export async function getAssignmentsByProjectIds(projectIds: readonly string[]): Promise<Assignment[]> {
  const ids = [...new Set(projectIds)].filter(Boolean);
  if (!ids.length) return [];

  const { client: supabase } = await resolveReadClient();
  if (!supabase) {
    const rows = await Promise.all(ids.map((id) => getAssignmentsByProjectIdViaPostgres(id)));
    return rows.flat();
  }

  try {
    const { data, error } = await withTimeout(supabase.from("assignments").select("*").in("project_id", ids).order("start_time"), 2600, "assignments (multi-project)");
    if (error || !data) {
      const rows = await Promise.all(ids.map((id) => getAssignmentsByProjectIdViaPostgres(id)));
      return rows.flat();
    }
    return data.map(mapAssignment);
  } catch {
    const rows = await Promise.all(ids.map((id) => getAssignmentsByProjectIdViaPostgres(id)));
    return rows.flat();
  }
}

// Every assignment for a set of vehicles, across all projects. Lets the
// single-vehicle profile page stop loading the whole fleet's history.
export async function getAssignmentsByVehicleIds(vehicleIds: readonly string[]): Promise<Assignment[]> {
  const ids = [...new Set(vehicleIds)].filter(Boolean);
  if (!ids.length) return [];

  const { client: supabase } = await resolveReadClient();
  if (!supabase) return demoKernel.assignments.filter((assignment) => assignment.vehicleId != null && ids.includes(assignment.vehicleId));

  try {
    const { data, error } = await withTimeout(supabase.from("assignments").select("*").in("vehicle_id", ids).order("start_time"), 2200, "assignments (by vehicle)");
    if (error || !data) return demoKernel.assignments.filter((assignment) => assignment.vehicleId != null && ids.includes(assignment.vehicleId));
    return data.map(mapAssignment);
  } catch {
    return demoKernel.assignments.filter((assignment) => assignment.vehicleId != null && ids.includes(assignment.vehicleId));
  }
}

async function getAssignmentsByProjectIdViaPostgres(projectId: string): Promise<Assignment[]> {
  const sql = getPostgresClient();
  if (!sql) return demoKernel.assignments.filter((assignment) => assignment.projectId === projectId);
  try {
    const data = await sql<Array<Record<string, unknown>>>`select * from assignments where project_id = ${projectId} order by start_time nulls last, created_at desc`;
    return data.length ? data.map(mapAssignment) : demoKernel.assignments.filter((assignment) => assignment.projectId === projectId);
  } catch {
    return demoKernel.assignments.filter((assignment) => assignment.projectId === projectId);
  }
}
