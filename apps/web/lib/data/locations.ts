import { cache } from "react";
import type { DriverLocation } from "@tomp/types/domain";
import { withTimeout } from "@/lib/async/timeout";
import { getPostgresClient } from "@/lib/db/postgres";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";
import { resolveReadClient } from "@/lib/supabase/scoped-client";

type LocationRow = Record<string, unknown>;

function text(row: LocationRow, key: string, fallback = "") {
  const value = row[key];
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : fallback;
}

function numberValue(row: LocationRow, key: string, fallback = 0) {
  const value = row[key];
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return fallback;
}

function nullableText(row: LocationRow, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function metadata(row: LocationRow) {
  const value = row.metadata;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function mapDriverLocation(row: LocationRow): DriverLocation {
  return {
    id: text(row, "id"),
    projectId: text(row, "project_id"),
    assignmentId: nullableText(row, "assignment_id"),
    driverId: nullableText(row, "driver_id"),
    vehicleId: nullableText(row, "vehicle_id"),
    latitude: numberValue(row, "latitude"),
    longitude: numberValue(row, "longitude"),
    accuracy: row.accuracy == null ? null : numberValue(row, "accuracy"),
    sharingEvent: text(row, "sharing_event", "location_ping") as DriverLocation["sharingEvent"],
    recordedAt: text(row, "recorded_at", text(row, "created_at", new Date().toISOString())),
    source: text(row, "source", "driver_web_app") as DriverLocation["source"],
    createdAt: text(row, "created_at", new Date().toISOString()),
    metadata: metadata(row)
  };
}

async function enrichLocationMetadata(client: NonNullable<ReturnType<typeof getSupabaseServerDataClient>>, locations: DriverLocation[]) {
  if (!locations.length) return locations;

  try {
  const projectIds = Array.from(new Set(locations.map((location) => location.projectId).filter(Boolean)));
  const assignmentIds = Array.from(new Set(locations.map((location) => location.assignmentId).filter(Boolean))) as string[];
  const driverIds = Array.from(new Set(locations.map((location) => location.driverId).filter(Boolean))) as string[];
  const vehicleIds = Array.from(new Set(locations.map((location) => location.vehicleId).filter(Boolean))) as string[];

  const [{ data: projects }, { data: assignments }, { data: drivers }, { data: vehicles }] = await withTimeout(Promise.all([
    projectIds.length ? client.from("projects").select("id, project_code, project_name").in("id", projectIds) : Promise.resolve({ data: [] }),
    assignmentIds.length ? client.from("assignments").select("id, mission_id, call_sign_id, status").in("id", assignmentIds) : Promise.resolve({ data: [] }),
    driverIds.length ? client.from("drivers").select("id, full_name, phone").in("id", driverIds) : Promise.resolve({ data: [] }),
    vehicleIds.length ? client.from("vehicles").select("id, plate_number, vehicle_type").in("id", vehicleIds) : Promise.resolve({ data: [] })
  ]), 3000, "location metadata");

  const callSignIds = Array.from(
    new Set((assignments || []).map((assignment) => (assignment as LocationRow).call_sign_id).filter((id): id is string => typeof id === "string"))
  );
  const missionIds = Array.from(
    new Set((assignments || []).map((assignment) => (assignment as LocationRow).mission_id).filter((id): id is string => typeof id === "string"))
  );

  const [{ data: callSigns }, { data: missions }] = await withTimeout(Promise.all([
    callSignIds.length ? client.from("call_signs").select("id, call_sign").in("id", callSignIds) : Promise.resolve({ data: [] }),
    missionIds.length ? client.from("missions").select("id, mission_code, mission_name").in("id", missionIds) : Promise.resolve({ data: [] })
  ]), 3000, "location assignment metadata");

  const projectById = new Map((projects || []).map((project) => [String((project as LocationRow).id), project as LocationRow]));
  const assignmentById = new Map((assignments || []).map((assignment) => [String((assignment as LocationRow).id), assignment as LocationRow]));
  const driverById = new Map((drivers || []).map((driver) => [String((driver as LocationRow).id), driver as LocationRow]));
  const vehicleById = new Map((vehicles || []).map((vehicle) => [String((vehicle as LocationRow).id), vehicle as LocationRow]));
  const callSignById = new Map((callSigns || []).map((callSign) => [String((callSign as LocationRow).id), callSign as LocationRow]));
  const missionById = new Map((missions || []).map((mission) => [String((mission as LocationRow).id), mission as LocationRow]));

  return locations.map((location) => {
    const project = projectById.get(location.projectId);
    const assignment = location.assignmentId ? assignmentById.get(location.assignmentId) : undefined;
    const driver = location.driverId ? driverById.get(location.driverId) : undefined;
    const vehicle = location.vehicleId ? vehicleById.get(location.vehicleId) : undefined;
    const callSign = assignment?.call_sign_id ? callSignById.get(String(assignment.call_sign_id)) : undefined;
    const mission = assignment?.mission_id ? missionById.get(String(assignment.mission_id)) : undefined;

    return {
      ...location,
      metadata: {
        ...location.metadata,
        projectCode: project ? text(project, "project_code") : location.projectId,
        projectName: project ? text(project, "project_name") : location.projectId,
        assignmentStatus: assignment ? text(assignment, "status") : undefined,
        callSign: callSign ? text(callSign, "call_sign") : undefined,
        driverName: driver ? text(driver, "full_name") : undefined,
        driverPhone: driver ? text(driver, "phone") : undefined,
        vehiclePlate: vehicle ? text(vehicle, "plate_number") : undefined,
        vehicleType: vehicle ? text(vehicle, "vehicle_type") : undefined,
        missionCode: mission ? text(mission, "mission_code") : undefined,
        missionName: mission ? text(mission, "mission_name") : undefined
      }
    };
  });
  } catch {
    return locations;
  }
}

function getDemoDriverLocations(projectId: string | null, limit = 50) {
  const now = new Date().toISOString();
  const locations = demoKernel.locations.filter((location) => !projectId || location.projectId === projectId);
  return locations.slice(0, limit).map((location) => ({
    ...location,
    recordedAt: now,
    createdAt: now,
    metadata: {
      ...location.metadata,
      label: "ข้อมูลตัวอย่าง"
    }
  }));
}

async function enrichLocationMetadataViaPostgres(locations: DriverLocation[]) {
  const sql = getPostgresClient();
  if (!sql || !locations.length) return locations;
  try {

  const projectIds = Array.from(new Set(locations.map((location) => location.projectId).filter(Boolean)));
  const assignmentIds = Array.from(new Set(locations.map((location) => location.assignmentId).filter(Boolean))) as string[];
  const driverIds = Array.from(new Set(locations.map((location) => location.driverId).filter(Boolean))) as string[];
  const vehicleIds = Array.from(new Set(locations.map((location) => location.vehicleId).filter(Boolean))) as string[];

  const [projects, assignments, drivers, vehicles] = await Promise.all([
    projectIds.length ? sql<LocationRow[]>`select id, project_code, project_name from projects where id in ${sql(projectIds)}` : Promise.resolve([]),
    assignmentIds.length ? sql<LocationRow[]>`select id, mission_id, call_sign_id, status from assignments where id in ${sql(assignmentIds)}` : Promise.resolve([]),
    driverIds.length ? sql<LocationRow[]>`select id, full_name, phone from drivers where id in ${sql(driverIds)}` : Promise.resolve([]),
    vehicleIds.length ? sql<LocationRow[]>`select id, plate_number, vehicle_type from vehicles where id in ${sql(vehicleIds)}` : Promise.resolve([])
  ]);

  const callSignIds = Array.from(new Set(assignments.map((assignment) => assignment.call_sign_id).filter((id): id is string => typeof id === "string")));
  const missionIds = Array.from(new Set(assignments.map((assignment) => assignment.mission_id).filter((id): id is string => typeof id === "string")));

  const [callSigns, missions] = await Promise.all([
    callSignIds.length ? sql<LocationRow[]>`select id, call_sign from call_signs where id in ${sql(callSignIds)}` : Promise.resolve([]),
    missionIds.length ? sql<LocationRow[]>`select id, mission_code, mission_name from missions where id in ${sql(missionIds)}` : Promise.resolve([])
  ]);

  const projectById = new Map(projects.map((project) => [String(project.id), project]));
  const assignmentById = new Map(assignments.map((assignment) => [String(assignment.id), assignment]));
  const driverById = new Map(drivers.map((driver) => [String(driver.id), driver]));
  const vehicleById = new Map(vehicles.map((vehicle) => [String(vehicle.id), vehicle]));
  const callSignById = new Map(callSigns.map((callSign) => [String(callSign.id), callSign]));
  const missionById = new Map(missions.map((mission) => [String(mission.id), mission]));

  return locations.map((location) => {
    const project = projectById.get(location.projectId);
    const assignment = location.assignmentId ? assignmentById.get(location.assignmentId) : undefined;
    const driver = location.driverId ? driverById.get(location.driverId) : undefined;
    const vehicle = location.vehicleId ? vehicleById.get(location.vehicleId) : undefined;
    const callSign = assignment?.call_sign_id ? callSignById.get(String(assignment.call_sign_id)) : undefined;
    const mission = assignment?.mission_id ? missionById.get(String(assignment.mission_id)) : undefined;

    return {
      ...location,
      metadata: {
        ...location.metadata,
        projectCode: project ? text(project, "project_code") : location.projectId,
        projectName: project ? text(project, "project_name") : location.projectId,
        assignmentStatus: assignment ? text(assignment, "status") : undefined,
        callSign: callSign ? text(callSign, "call_sign") : undefined,
        driverName: driver ? text(driver, "full_name") : undefined,
        driverPhone: driver ? text(driver, "phone") : undefined,
        vehiclePlate: vehicle ? text(vehicle, "plate_number") : undefined,
        vehicleType: vehicle ? text(vehicle, "vehicle_type") : undefined,
        missionCode: mission ? text(mission, "mission_code") : undefined,
        missionName: mission ? text(mission, "mission_name") : undefined
      }
    };
  });
  } catch {
    return locations;
  }
}

const LOCATIONS_UNAVAILABLE_MESSAGE = "บริการตำแหน่งคนขับไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง";

// Fallback path when the Supabase data client is unavailable or fails.
// - allowDemo: true  -> no database configured at all, demo data is expected
// - allowDemo: false -> the database is configured but errored; surface the
//   failure (throw) instead of silently serving fabricated demo rows.
async function getLatestDriverLocationsFallback(
  projectId: string | null,
  limit: number,
  { allowDemo }: { allowDemo: boolean }
): Promise<DriverLocation[]> {
  const sql = getPostgresClient();
  if (!sql) {
    if (allowDemo) return getDemoDriverLocations(projectId, limit);
    throw new Error(LOCATIONS_UNAVAILABLE_MESSAGE);
  }
  let data: LocationRow[];
  try {
    data = projectId
      ? await sql<LocationRow[]>`select * from gps_locations where project_id = ${projectId} order by recorded_at desc limit ${limit}`
      : await sql<LocationRow[]>`select * from gps_locations order by recorded_at desc limit ${limit}`;
  } catch {
    if (allowDemo) return getDemoDriverLocations(projectId, limit);
    throw new Error(LOCATIONS_UNAVAILABLE_MESSAGE);
  }

  const latestByAssignment = new Map<string, DriverLocation>();
  data.map(mapDriverLocation).forEach((location) => {
    const key = location.assignmentId || location.driverId || location.id;
    if (!latestByAssignment.has(key)) {
      latestByAssignment.set(key, location);
    }
  });

  return enrichLocationMetadataViaPostgres(Array.from(latestByAssignment.values()));
}

// cache(): one render often needs this list from several components; keep it to one query per request.
export const getLatestDriverLocationsByProjectId = cache(async function getLatestDriverLocationsByProjectId(projectId: string): Promise<DriverLocation[]> {
  const { client } = await resolveReadClient();

  if (!client) {
    return getLatestDriverLocationsFallback(projectId, 50, { allowDemo: true });
  }

  let data: LocationRow[] | null | undefined;
  let error: unknown;
  try {
    const result = await withTimeout(
      client.from("gps_locations").select("*").eq("project_id", projectId).order("recorded_at", { ascending: false }).limit(50),
      6000,
      "project driver locations"
    );
    data = result.data as LocationRow[] | null;
    error = result.error;
  } catch {
    return getLatestDriverLocationsFallback(projectId, 50, { allowDemo: false });
  }

  if (error) {
    return getLatestDriverLocationsFallback(projectId, 50, { allowDemo: false });
  }

  if (!data?.length) {
    return [];
  }

  const latestByAssignment = new Map<string, DriverLocation>();
  data
    .map(mapDriverLocation)
    // drop seed/placeholder rows — they never move and read as a "stuck" marker
    .filter((location) => !["placeholder", "demo"].includes(String(location.source)) && (location.latitude !== 0 || location.longitude !== 0))
    .forEach((location) => {
      const key = location.assignmentId || location.driverId || location.id;
      if (!latestByAssignment.has(key)) {
        latestByAssignment.set(key, location);
      }
    });

  return enrichLocationMetadata(client, Array.from(latestByAssignment.values()));
});
// cache(): one render often needs this list from several components; keep it to one query per request.
export const getLatestDriverLocations = cache(async function getLatestDriverLocations(limit = 50): Promise<DriverLocation[]> {
  const { client } = await resolveReadClient();

  if (!client) {
    return getLatestDriverLocationsFallback(null, limit, { allowDemo: true });
  }

  let data: LocationRow[] | null | undefined;
  let error: unknown;
  try {
    const result = await withTimeout(client.from("gps_locations").select("*").order("recorded_at", { ascending: false }).limit(limit), 6000, "driver locations");
    data = result.data as LocationRow[] | null;
    error = result.error;
  } catch {
    return getLatestDriverLocationsFallback(null, limit, { allowDemo: false });
  }

  if (error) {
    return getLatestDriverLocationsFallback(null, limit, { allowDemo: false });
  }

  if (!data?.length) {
    return [];
  }

  const latestByAssignment = new Map<string, DriverLocation>();
  data
    .map(mapDriverLocation)
    // drop seed/placeholder rows — they never move and read as a "stuck" marker
    .filter((location) => !["placeholder", "demo"].includes(String(location.source)) && (location.latitude !== 0 || location.longitude !== 0))
    .forEach((location) => {
      const key = location.assignmentId || location.driverId || location.id;
      if (!latestByAssignment.has(key)) {
        latestByAssignment.set(key, location);
      }
    });

  return enrichLocationMetadata(client, Array.from(latestByAssignment.values()));
});

export interface LatestLocationByCallSign {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: string;
  sharingEvent: DriverLocation["sharingEvent"];
  metadata: Record<string, unknown>;
}

export const getLatestLocationsByCallSign = cache(async function getLatestLocationsByCallSign(
  projectId: string
): Promise<Record<string, LatestLocationByCallSign>> {
  const { client } = await resolveReadClient();
  if (!client) return getLatestLocationsByCallSignViaPostgres(projectId);

  try {
    const { data, error } = await withTimeout(
      client
        .from("gps_locations")
        .select("call_sign_id, latitude, longitude, accuracy, recorded_at, sharing_event, source, metadata")
        .eq("project_id", projectId)
        .not("call_sign_id", "is", null)
        .order("recorded_at", { ascending: false })
        .limit(500),
      6000,
      "latest locations by call sign"
    );
    if (error || !data) return getLatestLocationsByCallSignViaPostgres(projectId);
    return rowsToLatestLocationsByCallSign(data as LocationRow[]);
  } catch {
    return getLatestLocationsByCallSignViaPostgres(projectId);
  }
});

function rowsToLatestLocationsByCallSign(rows: LocationRow[]): Record<string, LatestLocationByCallSign> {
  const latest: Record<string, LatestLocationByCallSign> = {};
  for (const row of rows) {
    const callSignId = text(row, "call_sign_id");
    const source = text(row, "source");
    const latitude = numberValue(row, "latitude");
    const longitude = numberValue(row, "longitude");
    if (!callSignId || latest[callSignId]) continue;
    if (["placeholder", "demo"].includes(source) || (latitude === 0 && longitude === 0)) continue;
    latest[callSignId] = {
      latitude,
      longitude,
      accuracy: row.accuracy == null ? null : numberValue(row, "accuracy"),
      recordedAt: text(row, "recorded_at", text(row, "created_at", new Date().toISOString())),
      sharingEvent: text(row, "sharing_event", "location_ping") as DriverLocation["sharingEvent"],
      metadata: metadata(row)
    };
  }
  return latest;
}

async function getLatestLocationsByCallSignViaPostgres(projectId: string): Promise<Record<string, LatestLocationByCallSign>> {
  const sql = getPostgresClient();
  if (!sql) return {};
  try {
    const rows = await sql<LocationRow[]>`
      select call_sign_id, latitude, longitude, accuracy, recorded_at, sharing_event, source, metadata
      from gps_locations
      where project_id = ${projectId}
        and call_sign_id is not null
      order by recorded_at desc nulls last, created_at desc
      limit 500
    `;
    return rowsToLatestLocationsByCallSign(rows);
  } catch {
    return {};
  }
}
// cache(): one render often needs this list from several components; keep it to one query per request.
export const getProjectIdWithLatestDriverLocation = cache(async function getProjectIdWithLatestDriverLocation(): Promise<string | null> {
  const { client } = await resolveReadClient();

  if (!client) {
    return getProjectIdWithLatestDriverLocationViaPostgres();
  }

  let data: LocationRow | null | undefined;
  let error: unknown;
  try {
    const result = await withTimeout(client.from("gps_locations").select("project_id").order("recorded_at", { ascending: false }).limit(1).maybeSingle(), 4000, "latest location project");
    data = result.data as LocationRow | null;
    error = result.error;
  } catch {
    return getProjectIdWithLatestDriverLocationViaPostgres();
  }

  if (error || !data) {
    return getProjectIdWithLatestDriverLocationViaPostgres();
  }

  return text(data as LocationRow, "project_id") || null;
});
async function getProjectIdWithLatestDriverLocationViaPostgres(): Promise<string | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<LocationRow[]>`select project_id from gps_locations order by recorded_at desc limit 1`;
    return rows[0] ? text(rows[0], "project_id") || null : null;
  } catch {
    return null;
  }
}
