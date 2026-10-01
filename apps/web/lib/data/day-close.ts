import "server-only";

import { getPostgresClient } from "@/lib/db/postgres";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getLatestAssignmentStatuses } from "@/lib/data/assignment-status";
import { getCallSignsByProjectId } from "@/lib/data/call-signs";
import { getDriverCommsByProjectId } from "@/lib/data/driver-comms";
import { getMissionsByProjectId } from "@/lib/data/missions";
import { getProjectDrivers, getProjectVehicles } from "@/lib/data/resources";
import { resolveReadClient } from "@/lib/supabase/scoped-client";
import { summarizeDay, type SessionEvent } from "@/lib/domain/day-close";
import { readDutyAdjustment, readDutySchedule, type DutyAdjustment, type DutySchedule } from "@/lib/domain/duty-hours";

export function bangkokToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Clock-in/out events from the day before to the day after — a shift can cross midnight. */
async function getSessionEvents(projectId: string, date: string): Promise<SessionEvent[]> {
  const from = new Date(`${date}T00:00:00+07:00`).getTime() - 12 * 3_600_000;
  const to = new Date(`${date}T00:00:00+07:00`).getTime() + 36 * 3_600_000;
  const range = { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
  const toEvent = (row: Record<string, unknown>): SessionEvent | null =>
    row.driver_id
      ? {
          driverId: String(row.driver_id),
          status: row.status as SessionEvent["status"],
          at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
        }
      : null;

  const { client } = await resolveReadClient();
  if (client) {
    const { data, error } = await client
      .from("assignment_status_updates")
      .select("driver_id, status, created_at")
      .eq("project_id", projectId)
      .in("status", ["work_started", "work_ended"])
      .gte("created_at", range.from)
      .lte("created_at", range.to)
      .order("created_at");
    if (!error && data) return (data as Record<string, unknown>[]).map(toEvent).filter((event): event is SessionEvent => Boolean(event));
  }
  const sql = getPostgresClient();
  if (!sql) return [];
  const rows = await sql<Record<string, unknown>[]>`
    select driver_id, status, created_at from assignment_status_updates
    where project_id = ${projectId} and status in ('work_started', 'work_ended')
      and created_at between ${range.from} and ${range.to}
    order by created_at
  `;
  return rows.map(toEvent).filter((event): event is SessionEvent => Boolean(event));
}

export async function getDayClose(projectId: string, date: string) {
  const [assignmentsResult, callSignsResult, drivers, vehicles, reported, comms, sessions, missionsResult] = await Promise.all([
    getAssignmentsByProjectId(projectId),
    getCallSignsByProjectId(projectId),
    getProjectDrivers(projectId),
    getProjectVehicles(projectId),
    getLatestAssignmentStatuses(projectId),
    getDriverCommsByProjectId(projectId),
    getSessionEvents(projectId, date),
    getMissionsByProjectId(projectId)
  ]);
  // Each unit's clock-in/out comes from the main job it was given in step 1.
  const missionById = new Map(missionsResult.data.map((mission) => [mission.id, mission]));
  const schedules: Record<string, DutySchedule> = {};
  const adjustments: Record<string, DutyAdjustment | null> = {};
  for (const callSign of callSignsResult.data) {
    const missionId = (callSign.metadata as Record<string, unknown> | undefined)?.missionId;
    const mission = typeof missionId === "string" ? missionById.get(missionId) : undefined;
    if (!mission) continue;
    schedules[callSign.id] = readDutySchedule(mission.metadata as Record<string, unknown>);
    adjustments[callSign.id] = readDutyAdjustment(mission.metadata as Record<string, unknown>, date, callSign.id);
  }
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const openIssues: Record<string, number> = {};
  for (const message of comms.inbound) {
    if (message.kind === "issue" && message.status !== "closed") openIssues[message.assignmentId] = (openIssues[message.assignmentId] ?? 0) + 1;
  }

  const summary = summarizeDay({
    date,
    jobs: assignmentsResult.data.map((assignment) => ({
      id: assignment.id,
      callSignId: assignment.callSignId ?? null,
      driverId: assignment.driverId ?? null,
      vehicleId: assignment.vehicleId ?? null,
      status: assignment.status,
      startTime: assignment.startTime ?? null,
      endTime: assignment.endTime ?? null
    })),
    units: callSignsResult.data.map((callSign) => {
      const driver = callSign.driverId ? driverById.get(callSign.driverId) : undefined;
      const vehicle = callSign.vehicleId ? vehicleById.get(callSign.vehicleId) : undefined;
      return {
        id: callSign.id,
        label: callSign.callSign,
        driverId: callSign.driverId ?? null,
        driverName: driver?.fullName ?? null,
        vehicleId: callSign.vehicleId ?? null,
        plate: vehicle?.plateNumber ?? null,
        vehicleMetadata: (vehicle?.metadata as Record<string, unknown> | undefined) ?? null
      };
    }),
    sessions,
    reported,
    openIssues,
    schedules,
    adjustments,
    now: date === bangkokToday() ? Date.now() : undefined
  });
  const loadError = !assignmentsResult.ok ? assignmentsResult.error : !callSignsResult.ok ? callSignsResult.error : null;
  return { ...summary, loadError };
}
