import type { Assignment, CallSign, Driver, DriverAssignmentPacket, DriverNotification, Project, RouteChangeInstruction, Vehicle } from "@tomp/types/domain";
import { hashDriverAccessToken } from "@/lib/driver-access/token";
import { getDriverAssignmentPacketByAssignmentId, getDriverNotificationsByAssignmentId, getRouteChangesByAssignmentId } from "@/lib/data/driver-operations";
import { getPostgresClient } from "@/lib/db/postgres";
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
  if (!token.startsWith("tomp_")) {
    return null;
  }

  const tokenHash = hashDriverAccessToken(token);
  const { client } = getSupabaseWriteClient();
  if (!client) {
    return getDriverAssignmentByTokenViaPostgres(token, tokenHash);
  }

  const { data: tokenRow } = await client
    .from("driver_access_tokens")
    .select("project_id, assignment_id, driver_id, status, expires_at")
    .eq("token_hash", tokenHash)
    .eq("status", "active")
    .maybeSingle();

  if (!tokenRow?.project_id || !tokenRow.assignment_id || (tokenRow.expires_at && new Date(String(tokenRow.expires_at)).getTime() <= Date.now())) {
    return getDriverAssignmentByTokenViaPostgres(token, tokenHash);
  }

  const [{ data: project }, { data: assignment }] = await Promise.all([
    client.from("projects").select("*").eq("id", tokenRow.project_id).maybeSingle(),
    client.from("assignments").select("*").eq("id", tokenRow.assignment_id).maybeSingle()
  ]);

  if (!project || !assignment) {
    return getDriverAssignmentByTokenViaPostgres(token, tokenHash);
  }

  const [{ data: callSign }, { data: driver }, { data: vehicle }] = await Promise.all([
    client.from("call_signs").select("*").eq("id", assignment.call_sign_id).maybeSingle(),
    assignment.driver_id ? client.from("drivers").select("*").eq("id", assignment.driver_id).maybeSingle() : Promise.resolve({ data: null }),
    assignment.vehicle_id ? client.from("vehicles").select("*").eq("id", assignment.vehicle_id).maybeSingle() : Promise.resolve({ data: null })
  ]);

  if (!callSign || !driver || !vehicle) {
    return getDriverAssignmentByTokenViaPostgres(token, tokenHash);
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

async function getDriverAssignmentByTokenViaPostgres(token: string, tokenHash: string): Promise<DriverAccessAssignment | null> {
  const sql = getPostgresClient();
  if (!sql) return null;

  const tokenRows = await sql<Row[]>`
    select project_id, assignment_id, driver_id, status, expires_at
    from driver_access_tokens
    where token_hash = ${tokenHash}
      and status = 'active'
    limit 1
  `;
  const tokenRow = tokenRows[0];
  if (!tokenRow?.project_id || !tokenRow.assignment_id) return null;
  if (tokenRow.expires_at && new Date(String(tokenRow.expires_at)).getTime() <= Date.now()) return null;

  const assignmentRows = await sql<Row[]>`
    select * from assignments where id = ${String(tokenRow.assignment_id)} limit 1
  `;
  const assignment = assignmentRows[0];
  if (!assignment) return null;

  const [projectRows, callSignRows, driverRows, vehicleRows, packetRows, notificationRows, routeChangeRows] = await Promise.all([
    sql<Row[]>`select * from projects where id = ${String(tokenRow.project_id)} limit 1`,
    sql<Row[]>`select * from call_signs where id = ${String(assignment.call_sign_id)} limit 1`,
    assignment.driver_id ? sql<Row[]>`select * from drivers where id = ${String(assignment.driver_id)} limit 1` : Promise.resolve([]),
    assignment.vehicle_id ? sql<Row[]>`select * from vehicles where id = ${String(assignment.vehicle_id)} limit 1` : Promise.resolve([]),
    sql<Row[]>`select payload from driver_assignment_packets where assignment_id = ${String(tokenRow.assignment_id)} order by created_at desc limit 1`,
    sql<Row[]>`select * from driver_notifications where assignment_id = ${String(tokenRow.assignment_id)} order by sent_at desc limit 10`,
    sql<Row[]>`select * from route_change_instructions where assignment_id = ${String(tokenRow.assignment_id)} order by created_at desc limit 5`
  ]);

  const project = projectRows[0];
  const callSign = callSignRows[0];
  const driver = driverRows[0];
  const vehicle = vehicleRows[0];
  if (!project || !callSign || !driver || !vehicle) return null;

  await sql`
    update driver_access_tokens
    set last_accessed_at = now(),
        used_at = coalesce(used_at, now()),
        access_count = coalesce(access_count, 0) + 1
    where token_hash = ${tokenHash}
  `.catch(async () => {
    await sql`
      update driver_access_tokens
      set last_used_at = now(),
          usage_count = coalesce(usage_count, 0) + 1
      where token_hash = ${tokenHash}
    `.catch(() => undefined);
  });

  const packetPayload = packetRows[0]?.payload;

  return {
    token,
    tokenValidated: true,
    packet: packetPayload && typeof packetPayload === "object" ? (packetPayload as DriverAssignmentPacket) : null,
    notifications: notificationRows.map((row) => ({
      id: text(row, "id"),
      projectId: text(row, "project_id"),
      assignmentId: nullableText(row, "assignment_id"),
      driverId: nullableText(row, "driver_id"),
      notificationType: text(row, "notification_type"),
      priority: text(row, "priority", "normal") as DriverNotification["priority"],
      title: text(row, "title"),
      body: text(row, "body"),
      action: "acknowledge",
      actionLabel: nullableText(row, "action_label"),
      actionUrl: nullableText(row, "action_url"),
      status: text(row, "status", "unread") as DriverNotification["status"],
      createdAt: text(row, "sent_at", text(row, "created_at", new Date().toISOString())),
      expiresAt: nullableText(row, "expires_at"),
      metadata: metadata(row)
    })),
    routeChanges: routeChangeRows.map((row) => ({
      id: text(row, "id"),
      assignmentId: text(row, "assignment_id"),
      reason: text(row, "reason"),
      impactSummary: nullableText(row, "impact_summary"),
      oldRoute: row.old_route && typeof row.old_route === "object" ? (row.old_route as RouteChangeInstruction["oldRoute"]) : null,
      newRoute: row.new_route && typeof row.new_route === "object" ? (row.new_route as RouteChangeInstruction["newRoute"]) : { summary: "เส้นทางที่ศูนย์ควบคุมแจ้ง", stops: [], metadata: {} },
      status: text(row, "status", "pending") as RouteChangeInstruction["status"]
    })),
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
