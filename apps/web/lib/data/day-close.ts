import "server-only";

import { getPostgresClient } from "@/lib/db/postgres";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getLatestAssignmentStatuses } from "@/lib/data/assignment-status";
import { getCallSignsByProjectId } from "@/lib/data/call-signs";
import { getDriverCommsByProjectId } from "@/lib/data/driver-comms";
import { getMissionsByProjectId } from "@/lib/data/missions";
import { getProjectDrivers, getProjectVehicles } from "@/lib/data/resources";
import { resolveReadClient } from "@/lib/supabase/scoped-client";
import { bangkokDateOf, summarizeDay, type DayCloseDay, type DayCloseJob, type DayCloseUnit, type SessionEvent } from "@/lib/domain/day-close";
import { daysBetween, readDutyAdjustment, readDutySchedule, type DutyAdjustment, type DutySchedule } from "@/lib/domain/duty-hours";

export function bangkokToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** The longest span the project view summarizes in one go. */
export const DAY_CLOSE_MAX_DAYS = 92;

/** Clock-in/out events from the day before `from` to the day after `to` — a shift can cross midnight. */
async function getSessionEvents(projectId: string, from: string, to: string): Promise<SessionEvent[]> {
  const range = {
    from: new Date(new Date(`${from}T00:00:00+07:00`).getTime() - 12 * 3_600_000).toISOString(),
    to: new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 36 * 3_600_000).toISOString()
  };
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
      .order("created_at")
      .limit(10000);
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

/** Everything a day's summary needs, loaded once for one day or many. */
async function loadDayCloseBase(projectId: string, from: string, to: string) {
  const [assignmentsResult, callSignsResult, drivers, vehicles, reported, comms, sessions, missionsResult] = await Promise.all([
    getAssignmentsByProjectId(projectId),
    getCallSignsByProjectId(projectId),
    getProjectDrivers(projectId),
    getProjectVehicles(projectId),
    getLatestAssignmentStatuses(projectId),
    getDriverCommsByProjectId(projectId),
    getSessionEvents(projectId, from, to),
    getMissionsByProjectId(projectId)
  ]);
  // Each unit's clock-in/out comes from the main job it was given in step 1.
  const missionById = new Map(missionsResult.data.map((mission) => [mission.id, mission]));
  const missionMetaByUnit = new Map<string, Record<string, unknown>>();
  const schedules: Record<string, DutySchedule> = {};
  for (const callSign of callSignsResult.data) {
    const missionId = (callSign.metadata as Record<string, unknown> | undefined)?.missionId;
    const mission = typeof missionId === "string" ? missionById.get(missionId) : undefined;
    if (!mission) continue;
    const meta = mission.metadata as Record<string, unknown>;
    missionMetaByUnit.set(callSign.id, meta);
    schedules[callSign.id] = readDutySchedule(meta);
  }
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const openIssues: Record<string, number> = {};
  for (const message of comms.inbound) {
    if (message.kind === "issue" && message.status !== "closed") openIssues[message.assignmentId] = (openIssues[message.assignmentId] ?? 0) + 1;
  }
  const jobs: DayCloseJob[] = assignmentsResult.data.map((assignment) => ({
    id: assignment.id,
    callSignId: assignment.callSignId ?? null,
    driverId: assignment.driverId ?? null,
    vehicleId: assignment.vehicleId ?? null,
    status: assignment.status,
    startTime: assignment.startTime ?? null,
    endTime: assignment.endTime ?? null
  }));
  const units: DayCloseUnit[] = callSignsResult.data.map((callSign) => {
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
  });
  const loadError = !assignmentsResult.ok ? assignmentsResult.error : !callSignsResult.ok ? callSignsResult.error : null;
  const today = bangkokToday();

  function summarizeOn(date: string) {
    const adjustments: Record<string, DutyAdjustment | null> = {};
    for (const [unitId, meta] of missionMetaByUnit) adjustments[unitId] = readDutyAdjustment(meta, date, unitId);
    return summarizeDay({ date, jobs, units, sessions, reported, openIssues, schedules, adjustments, now: date === today ? Date.now() : undefined });
  }

  return { jobs, units, loadError, summarizeOn };
}

export async function getDayClose(projectId: string, date: string) {
  const base = await loadDayCloseBase(projectId, date, date);
  return { ...base.summarizeOn(date), loadError: base.loadError };
}

/**
 * Every day from `from` to `to` that has work, each summarized as on its own
 * day-close page — for the project view and the multi-day export. Days with
 * no work are left out. At most DAY_CLOSE_MAX_DAYS days.
 */
export async function getDayCloseRange(projectId: string, from: string, to: string): Promise<{ days: DayCloseDay[]; units: DayCloseUnit[]; workDays: string[]; loadError: string | null; truncated: boolean }> {
  const span = daysBetween(from, to);
  const truncated = span.length > DAY_CLOSE_MAX_DAYS;
  const last = truncated ? span[DAY_CLOSE_MAX_DAYS - 1] : to;
  const base = await loadDayCloseBase(projectId, from, last);
  const workDays = [
    ...new Set(
      base.jobs
        .filter((job) => job.startTime && !["cancelled", "archived"].includes(job.status))
        .map((job) => bangkokDateOf(job.startTime as string))
    )
  ]
    .filter((day) => day >= from && day <= last)
    .sort();
  const days = workDays.map((date) => ({ date, ...base.summarizeOn(date) })).filter((day) => day.rows.length > 0);
  return { days, units: base.units, workDays, loadError: base.loadError, truncated };
}
