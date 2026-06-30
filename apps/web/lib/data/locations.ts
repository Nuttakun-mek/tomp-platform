import type { DriverLocation } from "@tomp/types/domain";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

type LocationRow = Record<string, unknown>;

function text(row: LocationRow, key: string, fallback = "") {
  const value = row[key];
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

  const projectIds = Array.from(new Set(locations.map((location) => location.projectId).filter(Boolean)));
  const assignmentIds = Array.from(new Set(locations.map((location) => location.assignmentId).filter(Boolean))) as string[];
  const driverIds = Array.from(new Set(locations.map((location) => location.driverId).filter(Boolean))) as string[];
  const vehicleIds = Array.from(new Set(locations.map((location) => location.vehicleId).filter(Boolean))) as string[];

  const [{ data: projects }, { data: assignments }, { data: drivers }, { data: vehicles }] = await Promise.all([
    projectIds.length ? client.from("projects").select("id, project_code, project_name").in("id", projectIds) : Promise.resolve({ data: [] }),
    assignmentIds.length ? client.from("assignments").select("id, mission_id, call_sign_id, status").in("id", assignmentIds) : Promise.resolve({ data: [] }),
    driverIds.length ? client.from("drivers").select("id, full_name, phone").in("id", driverIds) : Promise.resolve({ data: [] }),
    vehicleIds.length ? client.from("vehicles").select("id, plate_number, vehicle_type").in("id", vehicleIds) : Promise.resolve({ data: [] })
  ]);

  const callSignIds = Array.from(
    new Set((assignments || []).map((assignment) => (assignment as LocationRow).call_sign_id).filter((id): id is string => typeof id === "string"))
  );
  const missionIds = Array.from(
    new Set((assignments || []).map((assignment) => (assignment as LocationRow).mission_id).filter((id): id is string => typeof id === "string"))
  );

  const [{ data: callSigns }, { data: missions }] = await Promise.all([
    callSignIds.length ? client.from("call_signs").select("id, call_sign").in("id", callSignIds) : Promise.resolve({ data: [] }),
    missionIds.length ? client.from("missions").select("id, mission_code, mission_name").in("id", missionIds) : Promise.resolve({ data: [] })
  ]);

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
}

export async function getLatestDriverLocationsByProjectId(projectId: string): Promise<DriverLocation[]> {
  const client = getSupabaseServerDataClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("gps_locations")
    .select("*")
    .eq("project_id", projectId)
    .order("recorded_at", { ascending: false })
    .limit(50);

  if (error || !data?.length) {
    return [];
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
    return [];
  }

  const { data, error } = await client.from("gps_locations").select("*").order("recorded_at", { ascending: false }).limit(limit);

  if (error || !data?.length) {
    return [];
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
    return null;
  }

  const { data, error } = await client.from("gps_locations").select("project_id").order("recorded_at", { ascending: false }).limit(1).maybeSingle();

  if (error || !data) {
    return null;
  }

  return text(data as LocationRow, "project_id") || null;
}
