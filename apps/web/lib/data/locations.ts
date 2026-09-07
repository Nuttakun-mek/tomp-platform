import type { DriverLocation } from "@tomp/types/domain";
import { withTimeout } from "@/lib/async/timeout";
import { getPostgresClient } from "@/lib/db/postgres";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

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
  ]), 1600, "location metadata");

  const callSignIds = Array.from(
    new Set((assignments || []).map((assignment) => (assignment as LocationRow).call_sign_id).filter((id): id is string => typeof id === "string"))
  );
  const missionIds = Array.from(
    new Set((assignments || []).map((assignment) => (assignment as LocationRow).mission_id).filter((id): id is string => typeof id === "string"))
  );

  const [{ data: callSigns }, { data: missions }] = await withTimeout(Promise.all([
    callSignIds.length ? client.from("call_signs").select("id, call_sign").in("id", callSignIds) : Promise.resolve({ data: [] }),
    missionIds.length ? client.from("missions").select("id, mission_code, mission_name").in("id", missionIds) : Promise.resolve({ data: [] })
  ]), 1600, "location assignment metadata");

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

async function getLatestDriverLocationsViaPostgres(projectId: string | null, limit: number): Promise<DriverLocation[]> {
  const sql = getPostgresClient();
  if (!sql) return getDemoDriverLocations(projectId, limit);
  let data: LocationRow[];
  try {
    data = projectId
      ? await sql<LocationRow[]>`select * from gps_locations where project_id = ${projectId} order by recorded_at desc limit ${limit}`
      : await sql<LocationRow[]>`select * from gps_locations order by recorded_at desc limit ${limit}`;
  } catch {
    return getDemoDriverLocations(projectId, limit);
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

export async function getLatestDriverLocationsByProjectId(projectId: string): Promise<DriverLocation[]> {
  const client = getSupabaseServerDataClient();

  if (!client) {
    return getLatestDriverLocationsViaPostgres(projectId, 50);
  }

  let data: LocationRow[] | null | undefined;
  let error: unknown;
  try {
    const result = await withTimeout(
      client.from("gps_locations").select("*").eq("project_id", projectId).order("recorded_at", { ascending: false }).limit(50),
      2200,
      "project driver locations"
    );
    data = result.data as LocationRow[] | null;
    error = result.error;
  } catch {
    return getLatestDriverLocationsViaPostgres(projectId, 50);
  }

  if (error || !data?.length) {
    return getLatestDriverLocationsViaPostgres(projectId, 50);
  }

  const latestByAssignment = new Map<string, DriverLocation>();
  data.map(mapDriverLocation).forEach((location) => {
    const key = location.assignmentId || location.driverId || location.id;
    if (!latestByAssignment.has(key)) {
      latestByAssignment.set(key, location);
    }
  });

  return enrichLocationMetadata(client, Array.from(latestByAssignment.values()));
}

export async function getLatestDriverLocations(limit = 50): Promise<DriverLocation[]> {
  const client = getSupabaseServerDataClient();

  if (!client) {
    return getLatestDriverLocationsViaPostgres(null, limit);
  }

  let data: LocationRow[] | null | undefined;
  let error: unknown;
  try {
    const result = await withTimeout(client.from("gps_locations").select("*").order("recorded_at", { ascending: false }).limit(limit), 2200, "driver locations");
    data = result.data as LocationRow[] | null;
    error = result.error;
  } catch {
    return getLatestDriverLocationsViaPostgres(null, limit);
  }

  if (error || !data?.length) {
    return getLatestDriverLocationsViaPostgres(null, limit);
  }

  const latestByAssignment = new Map<string, DriverLocation>();
  data.map(mapDriverLocation).forEach((location) => {
    const key = location.assignmentId || location.driverId || location.id;
    if (!latestByAssignment.has(key)) {
      latestByAssignment.set(key, location);
    }
  });

  return enrichLocationMetadata(client, Array.from(latestByAssignment.values()));
}

export async function getProjectIdWithLatestDriverLocation(): Promise<string | null> {
  const client = getSupabaseServerDataClient();

  if (!client) {
    return getProjectIdWithLatestDriverLocationViaPostgres();
  }

  let data: LocationRow | null | undefined;
  let error: unknown;
  try {
    const result = await withTimeout(client.from("gps_locations").select("project_id").order("recorded_at", { ascending: false }).limit(1).maybeSingle(), 1800, "latest location project");
    data = result.data as LocationRow | null;
    error = result.error;
  } catch {
    return getProjectIdWithLatestDriverLocationViaPostgres();
  }

  if (error || !data) {
    return getProjectIdWithLatestDriverLocationViaPostgres();
  }

  return text(data as LocationRow, "project_id") || null;
}

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
