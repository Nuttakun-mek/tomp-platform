import type { Assignment, CallSign, Driver, DriverAssignmentPacket, DriverNotification, Project, RouteChangeInstruction, Vehicle } from "@tomp/types/domain";
import { hashDriverAccessToken } from "@/lib/driver-access/token";
import { getDriverAssignmentPacketByAssignmentId, getDriverNotificationsByAssignmentId, getRouteChangesByAssignmentId } from "@/lib/data/driver-operations";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

export interface DriverAccessAssignment {
  token: string;
  project: Project;
  assignment: Assignment;
  callSign: CallSign;
  driver: Driver;
  vehicle: Vehicle;
  packet?: DriverAssignmentPacket | null;
  notifications: DriverNotification[];
  routeChanges: RouteChangeInstruction[];
  tokenValidated: boolean;
}

type Row = Record<string, unknown>;

function text(row: Row | null | undefined, key: string, fallback = "") {
  const value = row?.[key];
  return typeof value === "string" ? value : fallback;
}

function nullableText(row: Row | null | undefined, key: string) {
  const value = row?.[key];
  return typeof value === "string" ? value : null;
}

function numberValue(row: Row | null | undefined, key: string, fallback = 0) {
  const value = row?.[key];
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return fallback;
}

function metadata(row: Row | null | undefined) {
  const value = row?.metadata;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function base(row: Row) {
  return {
    id: text(row, "id"),
    createdAt: text(row, "created_at", new Date().toISOString()),
    updatedAt: text(row, "updated_at", text(row, "created_at", new Date().toISOString())),
    createdBy: nullableText(row, "created_by"),
    updatedBy: nullableText(row, "updated_by"),
    archivedAt: nullableText(row, "archived_at"),
    deletedAt: nullableText(row, "deleted_at"),
    metadata: metadata(row)
  };
}

export async function getDriverAssignmentByToken(token: string): Promise<DriverAccessAssignment | null> {
  const { client } = getSupabaseWriteClient();
  if (!client || !token.startsWith("tomp_")) {
    return null;
  }

  const tokenHash = hashDriverAccessToken(token);
  const { data: tokenRow } = await client
    .from("driver_access_tokens")
    .select("project_id, assignment_id, driver_id, status, expires_at")
    .eq("token_hash", tokenHash)
    .eq("status", "active")
    .maybeSingle();

  if (!tokenRow?.project_id || !tokenRow.assignment_id || (tokenRow.expires_at && new Date(String(tokenRow.expires_at)).getTime() <= Date.now())) {
    return null;
  }

  const [{ data: project }, { data: assignment }] = await Promise.all([
    client.from("projects").select("*").eq("id", tokenRow.project_id).maybeSingle(),
    client.from("assignments").select("*").eq("id", tokenRow.assignment_id).maybeSingle()
  ]);

  if (!project || !assignment) {
    return null;
  }

  const [{ data: callSign }, { data: driver }, { data: vehicle }] = await Promise.all([
    client.from("call_signs").select("*").eq("id", assignment.call_sign_id).maybeSingle(),
    assignment.driver_id ? client.from("drivers").select("*").eq("id", assignment.driver_id).maybeSingle() : Promise.resolve({ data: null }),
    assignment.vehicle_id ? client.from("vehicles").select("*").eq("id", assignment.vehicle_id).maybeSingle() : Promise.resolve({ data: null })
  ]);

  if (!callSign || !driver || !vehicle) {
    return null;
  }

  await client
    .from("driver_access_tokens")
    .update({
      last_accessed_at: new Date().toISOString(),
      used_at: new Date().toISOString(),
      access_count: 1
    })
    .eq("token_hash", tokenHash);

  const [packet, notifications, routeChanges] = await Promise.all([
    getDriverAssignmentPacketByAssignmentId(text(assignment, "id")),
    getDriverNotificationsByAssignmentId(text(assignment, "id")),
    getRouteChangesByAssignmentId(text(assignment, "id"))
  ]);

  return {
    token,
    tokenValidated: true,
    packet,
    notifications,
    routeChanges,
    project: {
      ...base(project),
      organizationId: text(project, "organization_id"),
      ownerProfileId: nullableText(project, "owner_profile_id"),
      projectCode: text(project, "project_code"),
      projectName: text(project, "project_name"),
      startDate: text(project, "start_date"),
      endDate: text(project, "end_date"),
      timezone: text(project, "timezone", "Asia/Bangkok"),
      status: text(project, "status", "planning") as Project["status"],
      visibilityLevel: text(project, "visibility_level", "internal"),
      serviceLevel: text(project, "service_level", "standard")
    },
    assignment: {
      ...base(assignment),
      projectId: text(assignment, "project_id"),
      missionId: text(assignment, "mission_id"),
      callSignId: text(assignment, "call_sign_id"),
      vehicleId: nullableText(assignment, "vehicle_id"),
      driverId: nullableText(assignment, "driver_id"),
      status: text(assignment, "status", "planned") as Assignment["status"],
      startTime: nullableText(assignment, "start_time"),
      endTime: nullableText(assignment, "end_time"),
      commitmentId: nullableText(assignment, "commitment_id"),
      currentVersion: numberValue(assignment, "current_version", 1)
    },
    callSign: {
      ...base(callSign),
      projectId: text(callSign, "project_id"),
      callSign: text(callSign, "call_sign"),
      groupName: nullableText(callSign, "group_name"),
      status: text(callSign, "status", "active") as CallSign["status"]
    },
    driver: {
      ...base(driver),
      organizationId: nullableText(driver, "organization_id"),
      vendorId: nullableText(driver, "vendor_id"),
      fullName: text(driver, "full_name"),
      phone: text(driver, "phone"),
      licenseType: nullableText(driver, "license_type"),
      languages: Array.isArray(driver.languages) ? (driver.languages as string[]) : [],
      status: text(driver, "status", "assigned") as Driver["status"]
    },
    vehicle: {
      ...base(vehicle),
      organizationId: nullableText(vehicle, "organization_id"),
      vendorId: nullableText(vehicle, "vendor_id"),
      plateNumber: text(vehicle, "plate_number"),
      vehicleType: text(vehicle, "vehicle_type"),
      capacity: numberValue(vehicle, "capacity"),
      status: text(vehicle, "status", "assigned") as Vehicle["status"]
    }
  };
}

export async function getDriverActivationState(token: string) {
  return {
    token,
    confirmedName: false,
    confirmedPhone: false,
    confirmedVehicle: false,
    gpsConsent: false,
    vehiclePhotoCaptured: false,
    platePhotoCaptured: false,
    isFallback: false
  };
}
