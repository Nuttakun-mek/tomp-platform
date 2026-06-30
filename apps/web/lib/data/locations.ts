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
    recordedAt: text(row, "recorded_at", text(row, "created_at", new Date().toISOString())),
    source: text(row, "source", "driver_web_app") as DriverLocation["source"],
    createdAt: text(row, "created_at", new Date().toISOString()),
    metadata: metadata(row)
  };
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

  return Array.from(latestByAssignment.values());
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

  return Array.from(latestByAssignment.values());
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
