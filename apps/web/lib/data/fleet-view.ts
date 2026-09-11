import "server-only";

import type { Assignment, CallSign, Vehicle } from "@tomp/types/domain";
import { gpsFreshness, type GpsFreshness } from "@/lib/domain/gps-freshness";
import { hashObserverAccessToken } from "@/lib/driver-access/token";
import { getPostgresClient } from "@/lib/db/postgres";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { mapAssignment, mapCallSign, mapVehicle } from "./mappers";
import { getLatestLocationsByCallSign, type LatestLocationByCallSign } from "./locations";

type Row = Record<string, unknown>;

export interface FleetViewUnit {
  callSignId: string;
  callSign: string;
  vehicle: { plateNumber: string; vehicleType: string; colour: string | null; capacity: number | null } | null;
  driverName: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  recordedAt: string | null;
  freshness: GpsFreshness;
  destination: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface FleetView {
  tokenId: string;
  project: { id: string; name: string; code: string };
  requiresPin: boolean;
  showCrew: boolean;
  label: string | null;
  units: FleetViewUnit[];
}

interface ObserverProjectToken {
  id: string;
  projectId: string;
  scope: string;
  callSignIds: string[] | null;
  showCrew: boolean;
  pinHash: string | null;
  expiresAt: string | null;
  label: string | null;
}

function text(row: Row | null | undefined, key: string, fallback = "") {
  const value = row?.[key];
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : fallback;
}

function bool(row: Row | null | undefined, key: string, fallback = false) {
  return typeof row?.[key] === "boolean" ? row[key] : fallback;
}

function meta(row: { metadata?: Record<string, unknown> | null } | Row | null | undefined): Record<string, unknown> {
  const value = row?.metadata;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function routeMeta(assignment: Assignment | null | undefined, key: string) {
  const value = meta(assignment)[key] ?? meta(assignment)[key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapToken(row: Row): ObserverProjectToken {
  return {
    id: text(row, "id"),
    projectId: text(row, "project_id"),
    scope: text(row, "scope", "call_sign"),
    callSignIds: Array.isArray(row.call_sign_ids) ? row.call_sign_ids.filter((id): id is string => typeof id === "string") : null,
    showCrew: bool(row, "show_crew"),
    pinHash: text(row, "pin_hash") || null,
    expiresAt: text(row, "expires_at") || null,
    label: text(row, "label") || null
  };
}

function isExpired(expiresAt: string | null, now = Date.now()) {
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= now);
}

export function buildFleetViewFromRows({
  token,
  project,
  callSigns,
  vehicles,
  assignments,
  drivers,
  locationsByCallSign,
  now = Date.now()
}: {
  token: ObserverProjectToken;
  project: { id: string; projectName: string; projectCode: string };
  callSigns: CallSign[];
  vehicles: Vehicle[];
  assignments: Assignment[];
  drivers?: Array<{ id: string; fullName: string }>;
  locationsByCallSign: Record<string, LatestLocationByCallSign>;
  now?: number;
}): FleetView | null {
  if (token.scope !== "project" || isExpired(token.expiresAt, now)) return null;

  const visibleIds = token.callSignIds ? new Set(token.callSignIds) : null;
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const driverById = new Map((drivers ?? []).map((driver) => [driver.id, driver.fullName]));
  const assignmentsByCallSign = new Map<string, Assignment[]>();
  for (const assignment of assignments) {
    if (["cancelled", "archived"].includes(assignment.status)) continue;
    const bucket = assignmentsByCallSign.get(assignment.callSignId) ?? [];
    bucket.push(assignment);
    assignmentsByCallSign.set(assignment.callSignId, bucket);
  }

  const units = callSigns
    .filter((callSign) => callSign.status === "active")
    .filter((callSign) => !visibleIds || visibleIds.has(callSign.id))
    .sort((a, b) => a.callSign.localeCompare(b.callSign, "th"))
    .map((callSign): FleetViewUnit => {
      const unitAssignments = (assignmentsByCallSign.get(callSign.id) ?? []).sort((a, b) => {
        const aTime = a.startTime ? new Date(a.startTime).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.startTime ? new Date(b.startTime).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
      const current = unitAssignments.find((assignment) => assignment.status === "active") ?? unitAssignments[0] ?? null;
      const vehicle = (current?.vehicleId ? vehicleById.get(current.vehicleId) : undefined) ?? (callSign.vehicleId ? vehicleById.get(callSign.vehicleId) : undefined);
      const vehicleMeta = meta(vehicle);
      const location = locationsByCallSign[callSign.id];
      const driverName = token.showCrew && callSign.driverId ? driverById.get(callSign.driverId) ?? null : null;

      return {
        callSignId: callSign.id,
        callSign: callSign.callSign,
        vehicle: vehicle
          ? {
              plateNumber: vehicle.plateNumber,
              vehicleType: vehicle.vehicleType,
              colour: typeof vehicleMeta.colour === "string" ? vehicleMeta.colour : null,
              capacity: vehicle.capacity ?? null
            }
          : null,
        driverName,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        accuracy: location?.accuracy ?? null,
        recordedAt: location?.recordedAt ?? null,
        freshness: gpsFreshness(location?.recordedAt ?? null, location?.sharingEvent, now, location?.metadata),
        destination: routeMeta(current, "dropoffLocation"),
        startTime: current?.startTime ?? null,
        endTime: current?.endTime ?? null
      };
    });

  return {
    tokenId: token.id,
    project: { id: project.id, name: project.projectName, code: project.projectCode },
    requiresPin: Boolean(token.pinHash),
    showCrew: token.showCrew,
    label: token.label,
    units
  };
}

export async function getFleetViewByToken(token: string): Promise<FleetView | null> {
  if (!token.startsWith("tomp_obs_")) return null;
  const tokenHash = hashObserverAccessToken(token);
  const tokenRow = await findProjectToken(tokenHash);
  if (!tokenRow || tokenRow.scope !== "project" || isExpired(tokenRow.expiresAt)) return null;
  return loadFleetView(tokenRow);
}

export async function getFleetTokenPinState(token: string): Promise<{ tokenId: string; pinHash: string | null; expiresAt: string | null } | null> {
  if (!token.startsWith("tomp_obs_")) return null;
  const tokenRow = await findProjectToken(hashObserverAccessToken(token));
  if (!tokenRow || tokenRow.scope !== "project" || isExpired(tokenRow.expiresAt)) return null;
  return { tokenId: tokenRow.id, pinHash: tokenRow.pinHash, expiresAt: tokenRow.expiresAt };
}

async function findProjectToken(tokenHash: string): Promise<ObserverProjectToken | null> {
  const { client } = getSupabaseWriteClient();
  if (client) {
    const { data } = await client
      .from("observer_access_tokens")
      .select("id, project_id, scope, call_sign_ids, show_crew, pin_hash, expires_at, label")
      .eq("token_hash", tokenHash)
      .eq("status", "active")
      .maybeSingle();
    return data ? mapToken(data as Row) : null;
  }

  const sql = getPostgresClient();
  if (!sql) return null;
  const rows = await sql<Row[]>`
    select id, project_id, scope, call_sign_ids, show_crew, pin_hash, expires_at, label
    from observer_access_tokens
    where token_hash = ${tokenHash}
      and status = 'active'
    limit 1
  `;
  return rows[0] ? mapToken(rows[0]) : null;
}

async function loadFleetView(token: ObserverProjectToken): Promise<FleetView | null> {
  const { client } = getSupabaseWriteClient();
  if (client) {
    const [projectResult, callSignResult, vehicleResult, assignmentResult, driverResult] = await Promise.all([
      client.from("projects").select("id, project_code, project_name").eq("id", token.projectId).maybeSingle(),
      client.from("call_signs").select("*").eq("project_id", token.projectId).order("call_sign"),
      client.from("vehicles").select("*").eq("project_id", token.projectId).is("deleted_at", null).order("plate_number"),
      client.from("assignments").select("*").eq("project_id", token.projectId).order("start_time"),
      token.showCrew
        ? client.from("drivers").select("id, full_name").eq("project_id", token.projectId).is("deleted_at", null).order("full_name")
        : Promise.resolve({ data: [] })
    ]);
    if (!projectResult.data || !callSignResult.data || !vehicleResult.data || !assignmentResult.data) return null;
    return buildFleetViewFromRows({
      token,
      project: {
        id: text(projectResult.data as Row, "id"),
        projectName: text(projectResult.data as Row, "project_name"),
        projectCode: text(projectResult.data as Row, "project_code")
      },
      callSigns: (callSignResult.data as Row[]).map(mapCallSign),
      vehicles: (vehicleResult.data as Row[]).map(mapVehicle),
      assignments: (assignmentResult.data as Row[]).map(mapAssignment),
      drivers: ((driverResult.data ?? []) as Row[]).map((row) => ({ id: text(row, "id"), fullName: text(row, "full_name") })),
      locationsByCallSign: await getLatestLocationsByCallSign(token.projectId)
    });
  }

  const sql = getPostgresClient();
  if (!sql) return null;
  const [projectRows, callSignRows, vehicleRows, assignmentRows, driverRows] = await Promise.all([
    sql<Row[]>`select id, project_code, project_name from projects where id = ${token.projectId} limit 1`,
    sql<Row[]>`select * from call_signs where project_id = ${token.projectId} order by call_sign`,
    sql<Row[]>`select * from vehicles where project_id = ${token.projectId} and deleted_at is null order by plate_number`,
    sql<Row[]>`select * from assignments where project_id = ${token.projectId} order by start_time nulls last, created_at asc`,
    token.showCrew
      ? sql<Row[]>`select id, full_name from drivers where project_id = ${token.projectId} and deleted_at is null order by full_name`
      : Promise.resolve([])
  ]);
  const project = projectRows[0];
  if (!project) return null;
  return buildFleetViewFromRows({
    token,
    project: { id: text(project, "id"), projectName: text(project, "project_name"), projectCode: text(project, "project_code") },
    callSigns: callSignRows.map(mapCallSign),
    vehicles: vehicleRows.map(mapVehicle),
    assignments: assignmentRows.map(mapAssignment),
    drivers: driverRows.map((row) => ({ id: text(row, "id"), fullName: text(row, "full_name") })),
    locationsByCallSign: await getLatestLocationsByCallSign(token.projectId)
  });
}
