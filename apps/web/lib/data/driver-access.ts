import type { Assignment, CallSign, Driver, DriverAssignmentPacket, DriverNotification, Project, RouteChangeInstruction, Vehicle } from "@tomp/types/domain";
import { hashDriverAccessToken } from "@/lib/driver-access/token";
import { getDriverAssignmentPacketByAssignmentId, getDriverIssueMessagesByAssignmentId, getDriverNotificationsByAssignmentId, getRouteChangesByAssignmentId, type DriverIssueMessage } from "@/lib/data/driver-operations";
import { isUrgentMeta, orderDriverJobs } from "@/lib/domain/driver-day-order";
import { getPostgresClient } from "@/lib/db/postgres";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

export interface DriverTokenIdentity {
  tokenId: string;
  projectId: string;
  assignmentId: string;
  driverId: string;
  pinRequired: boolean;
  deviceBoundTo: string | null;
}

// One-query resolve of a QR token to the ids the driver session needs. Cheap
// enough to call on every session establishment; does not build the full packet.
export async function resolveDriverTokenIdentity(token: string): Promise<DriverTokenIdentity | null> {
  if (!token.startsWith("tomp_")) return null;
  const tokenHash = hashDriverAccessToken(token);

  const { client } = getSupabaseWriteClient();
  if (client) {
    const { data } = await client
      .from("driver_access_tokens")
      .select("id, project_id, assignment_id, driver_id, status, expires_at, metadata")
      .eq("token_hash", tokenHash)
      .eq("status", "active")
      .maybeSingle();
    if (data) return identityFromRow(data as Record<string, unknown>);
  }

  const sql = getPostgresClient();
  if (!sql) return null;
  const rows = await sql<Array<Record<string, unknown>>>`
    select id, project_id, assignment_id, driver_id, expires_at, metadata
    from driver_access_tokens where token_hash = ${tokenHash} and status = 'active' limit 1
  `;
  return rows[0] ? identityFromRow(rows[0]) : null;
}

function identityFromRow(row: Record<string, unknown>): DriverTokenIdentity | null {
  const assignmentId = typeof row.assignment_id === "string" ? row.assignment_id : "";
  const projectId = typeof row.project_id === "string" ? row.project_id : "";
  const driverId = typeof row.driver_id === "string" ? row.driver_id : "";
  if (!assignmentId || !projectId || !driverId) return null;
  const expiresAt = row.expires_at ? new Date(String(row.expires_at)).getTime() : 0;
  if (expiresAt && expiresAt <= Date.now()) return null;

  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    tokenId: String(row.id),
    projectId,
    assignmentId,
    driverId,
    pinRequired: typeof meta.pinHash === "string" && meta.pinHash.length > 0,
    deviceBoundTo: typeof meta.deviceHash === "string" && meta.deviceHash ? meta.deviceHash : null
  };
}

export interface DriverUpdates {
  assignmentStatus: string;
  latestStatus: { status: string; at: string } | null;
  dayAssignments: DriverDayAssignment[];
  notifications: DriverNotification[];
  messages: DriverIssueMessage[];
}

export interface DriverAccessAssignment {
  token: string;
  tokenId: string;
  pinRequired: boolean;
  /** sha256 of the device that claimed this token, or null if unclaimed. */
  deviceBoundTo: string | null;
  project: Project;
  assignment: Assignment;
  callSign: CallSign;
  driver: Driver;
  vehicle: Vehicle;
  packet?: DriverAssignmentPacket | null;
  notifications: DriverNotification[];
  routeChanges: RouteChangeInstruction[];
  messages: DriverIssueMessage[];
  latestStatus?: { status: string; at: string } | null;
  dayAssignments: DriverDayAssignment[];
  activated: boolean;
  tokenValidated: boolean;
}

export interface DriverDayAssignment {
  assignmentId: string;
  callSign: string;
  pickup: string;
  dropoff: string;
  startTime?: string | null;
  endTime?: string | null;
  status: string;
  isCurrent: boolean;
  /** 1-based order the driver should work through the list. */
  sequence: number;
  /** The next job to start after the current one — the one to head to now. */
  isNext: boolean;
  /** Flagged urgent / inserted by the control centre — do this out of turn. */
  urgent: boolean;
}

export interface DriverAssignmentSessionContext {
  tokenId: string;
  projectId: string;
  assignmentId: string;
  driverId: string;
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

function assignmentRouteSummary(assignment: Row) {
  const meta = metadata(assignment);
  return {
    pickup: text(meta, "pickupLocation") || text(meta, "pickup_location", "ยังไม่ระบุจุดรับ"),
    dropoff: text(meta, "dropoffLocation") || text(meta, "dropoff_location", "ยังไม่ระบุจุดส่ง")
  };
}

function sameOperationDay(value: string | null, anchor: string) {
  if (!value) return true;
  const date = new Date(value);
  const anchorDate = new Date(anchor);
  return date.getFullYear() === anchorDate.getFullYear() && date.getMonth() === anchorDate.getMonth() && date.getDate() === anchorDate.getDate();
}

function buildDayAssignments(rows: Row[], currentAssignmentId: string, resolveCallSign: (callSignId: string) => string | undefined): DriverDayAssignment[] {
  const byId = new Map(rows.map((row) => [text(row, "id"), row]));

  const ordered = orderDriverJobs(
    rows.map((row) => {
      const meta = metadata(row);
      return {
        id: text(row, "id"),
        status: text(row, "status", "planned"),
        startTime: nullableText(row, "start_time"),
        createdAt: nullableText(row, "created_at"),
        sequence: typeof meta.sequence === "number" ? meta.sequence : null,
        urgent: isUrgentMeta(meta),
        isCurrent: text(row, "id") === currentAssignmentId
      };
    })
  );

  return ordered.map((job) => {
    const row = byId.get(job.id) as Row;
    const route = assignmentRouteSummary(row);
    return {
      assignmentId: job.id,
      callSign: resolveCallSign(text(row, "call_sign_id")) || job.id.slice(0, 8),
      pickup: route.pickup,
      dropoff: route.dropoff,
      startTime: job.startTime,
      endTime: nullableText(row, "end_time"),
      status: job.status,
      isCurrent: job.isCurrent,
      sequence: job.order,
      isNext: job.isNext,
      urgent: job.urgent
    };
  });
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
    .select("id, project_id, assignment_id, driver_id, status, expires_at, metadata")
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

  const [packet, notifications, routeChanges, messages, checkinRes, latestStatusRes] = await Promise.all([
    getDriverAssignmentPacketByAssignmentId(text(assignment, "id")),
    getDriverNotificationsByAssignmentId(text(assignment, "id")),
    getRouteChangesByAssignmentId(text(assignment, "id")),
    getDriverIssueMessagesByAssignmentId(text(assignment, "id")),
    client.from("driver_checkins").select("id").eq("assignment_id", text(assignment, "id")).eq("status", "ready").limit(1),
    client
      .from("assignment_status_updates")
      .select("status, created_at")
      .eq("assignment_id", text(assignment, "id"))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);
  const activated = Boolean((checkinRes.data as unknown[] | null)?.length);
  const latestStatusRow = latestStatusRes.data as Row | null;
  const operationAnchor = nullableText(assignment, "start_time") || new Date().toISOString();

  const { data: dayAssignmentRows } = await client
    .from("assignments")
    .select("id, call_sign_id, start_time, end_time, status, metadata, created_at")
    .eq("project_id", text(assignment, "project_id"))
    .eq("driver_id", text(driver, "id"))
    .neq("status", "cancelled")
    .order("start_time", { ascending: true });

  const visibleDayRows = ((dayAssignmentRows || []) as Row[]).filter((row) => sameOperationDay(nullableText(row, "start_time"), operationAnchor));
  const dayCallSignIds = [...new Set(visibleDayRows.map((row) => text(row, "call_sign_id")).filter(Boolean))];
  const { data: dayCallSignRows } = dayCallSignIds.length
    ? await client.from("call_signs").select("id, call_sign").in("id", dayCallSignIds)
    : { data: [] as Row[] };
  const dayCallSignById = new Map(((dayCallSignRows || []) as Row[]).map((row) => [text(row, "id"), text(row, "call_sign")]));
  const dayAssignments = buildDayAssignments(visibleDayRows, text(assignment, "id"), (id) => dayCallSignById.get(id));

  const tokenMeta = (tokenRow.metadata ?? {}) as Record<string, unknown>;

  return {
    token,
    tokenId: String(tokenRow.id),
    pinRequired: typeof tokenMeta.pinHash === "string" && tokenMeta.pinHash.length > 0,
    deviceBoundTo: typeof tokenMeta.deviceHash === "string" && tokenMeta.deviceHash ? tokenMeta.deviceHash : null,
    tokenValidated: true,
    packet,
    notifications,
    routeChanges,
    messages,
    latestStatus: latestStatusRow ? { status: text(latestStatusRow, "status"), at: text(latestStatusRow, "created_at") } : null,
    dayAssignments,
    activated,
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

export async function getDriverAssignmentBySession(context: DriverAssignmentSessionContext): Promise<DriverAccessAssignment | null> {
  const { client } = getSupabaseWriteClient();
  if (!client) {
    return getDriverAssignmentBySessionViaPostgres(context);
  }

  const { data: tokenRow } = await client
    .from("driver_access_tokens")
    .select("id, project_id, assignment_id, driver_id, status, expires_at, metadata")
    .eq("id", context.tokenId)
    .eq("status", "active")
    .maybeSingle();

  if (!tokenRow || tokenRow.expires_at && new Date(String(tokenRow.expires_at)).getTime() <= Date.now()) {
    return getDriverAssignmentBySessionViaPostgres(context);
  }

  if (
    String(tokenRow.project_id) !== context.projectId ||
    String(tokenRow.assignment_id) !== context.assignmentId ||
    String(tokenRow.driver_id) !== context.driverId
  ) {
    return null;
  }

  const [{ data: project }, { data: assignment }] = await Promise.all([
    client.from("projects").select("*").eq("id", context.projectId).maybeSingle(),
    client.from("assignments").select("*").eq("id", context.assignmentId).maybeSingle()
  ]);

  if (!project || !assignment) {
    return getDriverAssignmentBySessionViaPostgres(context);
  }

  const assignmentRow = assignment as Row;
  if (text(assignmentRow, "project_id") !== context.projectId || text(assignmentRow, "driver_id") !== context.driverId) {
    return null;
  }

  const [{ data: callSign }, { data: driver }, { data: vehicle }] = await Promise.all([
    client.from("call_signs").select("*").eq("id", text(assignmentRow, "call_sign_id")).maybeSingle(),
    client.from("drivers").select("*").eq("id", context.driverId).maybeSingle(),
    text(assignmentRow, "vehicle_id") ? client.from("vehicles").select("*").eq("id", text(assignmentRow, "vehicle_id")).maybeSingle() : Promise.resolve({ data: null })
  ]);

  if (!callSign || !driver || !vehicle) {
    return getDriverAssignmentBySessionViaPostgres(context);
  }

  const [packet, notifications, routeChanges, messages, checkinRes, latestStatusRes] = await Promise.all([
    getDriverAssignmentPacketByAssignmentId(context.assignmentId),
    getDriverNotificationsByAssignmentId(context.assignmentId),
    getRouteChangesByAssignmentId(context.assignmentId),
    getDriverIssueMessagesByAssignmentId(context.assignmentId),
    client.from("driver_checkins").select("id").eq("assignment_id", context.assignmentId).eq("status", "ready").limit(1),
    client
      .from("assignment_status_updates")
      .select("status, created_at")
      .eq("assignment_id", context.assignmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const operationAnchor = nullableText(assignmentRow, "start_time") || new Date().toISOString();
  const { data: dayAssignmentRows } = await client
    .from("assignments")
    .select("id, call_sign_id, start_time, end_time, status, metadata, created_at")
    .eq("project_id", context.projectId)
    .eq("driver_id", context.driverId)
    .neq("status", "cancelled")
    .order("start_time", { ascending: true });
  const visibleDayRows = ((dayAssignmentRows || []) as Row[]).filter((row) => sameOperationDay(nullableText(row, "start_time"), operationAnchor));
  const dayCallSignIds = [...new Set(visibleDayRows.map((row) => text(row, "call_sign_id")).filter(Boolean))];
  const { data: dayCallSignRows } = dayCallSignIds.length
    ? await client.from("call_signs").select("id, call_sign").in("id", dayCallSignIds)
    : { data: [] as Row[] };
  const dayCallSignById = new Map(((dayCallSignRows || []) as Row[]).map((row) => [text(row, "id"), text(row, "call_sign")]));
  const tokenMeta = (tokenRow.metadata ?? {}) as Record<string, unknown>;
  const latestStatusRow = latestStatusRes.data as Row | null;

  return {
    token: "",
    tokenId: String(tokenRow.id),
    pinRequired: typeof tokenMeta.pinHash === "string" && tokenMeta.pinHash.length > 0,
    deviceBoundTo: typeof tokenMeta.deviceHash === "string" && tokenMeta.deviceHash ? tokenMeta.deviceHash : null,
    tokenValidated: true,
    packet,
    notifications,
    routeChanges,
    messages,
    latestStatus: latestStatusRow ? { status: text(latestStatusRow, "status"), at: text(latestStatusRow, "created_at") } : null,
    dayAssignments: buildDayAssignments(visibleDayRows, context.assignmentId, (id) => dayCallSignById.get(id)),
    activated: Boolean((checkinRes.data as unknown[] | null)?.length),
    project: {
      ...base(project as Row),
      organizationId: text(project as Row, "organization_id"),
      ownerProfileId: nullableText(project as Row, "owner_profile_id"),
      projectCode: text(project as Row, "project_code"),
      projectName: text(project as Row, "project_name"),
      startDate: text(project as Row, "start_date"),
      endDate: text(project as Row, "end_date"),
      timezone: text(project as Row, "timezone", "Asia/Bangkok"),
      status: text(project as Row, "status", "planning") as Project["status"],
      visibilityLevel: text(project as Row, "visibility_level", "internal"),
      serviceLevel: text(project as Row, "service_level", "standard")
    },
    assignment: {
      ...base(assignmentRow),
      projectId: text(assignmentRow, "project_id"),
      missionId: text(assignmentRow, "mission_id"),
      callSignId: text(assignmentRow, "call_sign_id"),
      vehicleId: nullableText(assignmentRow, "vehicle_id"),
      driverId: nullableText(assignmentRow, "driver_id"),
      status: text(assignmentRow, "status", "planned") as Assignment["status"],
      startTime: nullableText(assignmentRow, "start_time"),
      endTime: nullableText(assignmentRow, "end_time"),
      commitmentId: nullableText(assignmentRow, "commitment_id"),
      currentVersion: numberValue(assignmentRow, "current_version", 1)
    },
    callSign: {
      ...base(callSign as Row),
      projectId: text(callSign as Row, "project_id"),
      callSign: text(callSign as Row, "call_sign"),
      groupName: nullableText(callSign as Row, "group_name"),
      status: text(callSign as Row, "status", "active") as CallSign["status"]
    },
    driver: {
      ...base(driver as Row),
      organizationId: nullableText(driver as Row, "organization_id"),
      vendorId: nullableText(driver as Row, "vendor_id"),
      fullName: text(driver as Row, "full_name"),
      phone: text(driver as Row, "phone"),
      licenseType: nullableText(driver as Row, "license_type"),
      languages: Array.isArray((driver as Row).languages) ? ((driver as Row).languages as string[]) : [],
      status: text(driver as Row, "status", "assigned") as Driver["status"]
    },
    vehicle: {
      ...base(vehicle as Row),
      organizationId: nullableText(vehicle as Row, "organization_id"),
      vendorId: nullableText(vehicle as Row, "vendor_id"),
      plateNumber: text(vehicle as Row, "plate_number"),
      vehicleType: text(vehicle as Row, "vehicle_type"),
      capacity: numberValue(vehicle as Row, "capacity"),
      status: text(vehicle as Row, "status", "assigned") as Vehicle["status"]
    }
  };
}

async function getDriverAssignmentByTokenViaPostgres(token: string, tokenHash: string): Promise<DriverAccessAssignment | null> {
  const sql = getPostgresClient();
  if (!sql) return null;

  const tokenRows = await sql<Row[]>`
    select id, project_id, assignment_id, driver_id, status, expires_at, metadata
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

  const [projectRows, callSignRows, driverRows, vehicleRows, packetRows, notificationRows, routeChangeRows, messageRows, checkinRows, latestStatusRows] = await Promise.all([
    sql<Row[]>`select * from projects where id = ${String(tokenRow.project_id)} limit 1`,
    sql<Row[]>`select * from call_signs where id = ${String(assignment.call_sign_id)} limit 1`,
    assignment.driver_id ? sql<Row[]>`select * from drivers where id = ${String(assignment.driver_id)} limit 1` : Promise.resolve([]),
    assignment.vehicle_id ? sql<Row[]>`select * from vehicles where id = ${String(assignment.vehicle_id)} limit 1` : Promise.resolve([]),
    sql<Row[]>`select payload from driver_assignment_packets where assignment_id = ${String(tokenRow.assignment_id)} order by created_at desc limit 1`,
    sql<Row[]>`select * from driver_notifications where assignment_id = ${String(tokenRow.assignment_id)} order by sent_at desc limit 10`,
    sql<Row[]>`select * from route_change_instructions where assignment_id = ${String(tokenRow.assignment_id)} order by created_at desc limit 5`,
    sql<Row[]>`select id, message, created_at, issue_type, severity from driver_issue_reports where assignment_id = ${String(tokenRow.assignment_id)} order by created_at asc limit 50`,
    sql<Row[]>`select id from driver_checkins where assignment_id = ${String(tokenRow.assignment_id)} and status = 'ready' limit 1`,
    sql<Row[]>`select status, created_at from assignment_status_updates where assignment_id = ${String(tokenRow.assignment_id)} order by created_at desc limit 1`
  ]);

  const project = projectRows[0];
  const callSign = callSignRows[0];
  const driver = driverRows[0];
  const vehicle = vehicleRows[0];
  if (!project || !callSign || !driver || !vehicle) return null;
  const operationAnchor = nullableText(assignment, "start_time") || new Date().toISOString();
  const dayAssignmentRows = await sql<Row[]>`
    select id, call_sign_id, start_time, end_time, status, metadata, created_at
    from assignments
    where project_id = ${String(tokenRow.project_id)}
      and driver_id = ${String(driver.id)}
      and status <> 'cancelled'
    order by start_time asc nulls last, created_at asc
  `;
  const visibleDayRows = dayAssignmentRows.filter((row) => sameOperationDay(nullableText(row, "start_time"), operationAnchor));
  const dayCallSignIds = [...new Set(visibleDayRows.map((row) => text(row, "call_sign_id")).filter(Boolean))];
  const dayCallSignRows = dayCallSignIds.length
    ? await sql<Row[]>`select id, call_sign from call_signs where id in ${sql(dayCallSignIds)}`
    : [];
  const dayCallSignById = new Map(dayCallSignRows.map((row) => [text(row, "id"), text(row, "call_sign")]));
  const dayAssignments = buildDayAssignments(visibleDayRows, text(assignment, "id"), (id) => dayCallSignById.get(id));

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
  const pgTokenMeta = (tokenRow.metadata ?? {}) as Record<string, unknown>;

  return {
    tokenId: String(tokenRow.id),
    pinRequired: typeof pgTokenMeta.pinHash === "string" && pgTokenMeta.pinHash.length > 0,
    deviceBoundTo: typeof pgTokenMeta.deviceHash === "string" && pgTokenMeta.deviceHash ? pgTokenMeta.deviceHash : null,
    token,
    tokenValidated: true,
    packet: packetPayload && typeof packetPayload === "object" ? (packetPayload as DriverAssignmentPacket) : null,
    activated: checkinRows.length > 0,
    latestStatus: latestStatusRows[0] ? { status: text(latestStatusRows[0], "status"), at: text(latestStatusRows[0], "created_at") } : null,
    dayAssignments,
    messages: messageRows.map((row) => ({
      id: text(row, "id"),
      text: text(row, "message"),
      at: text(row, "created_at", new Date().toISOString()),
      issueType: text(row, "issue_type", "message"),
      severity: text(row, "severity", "info")
    })),
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

async function getDriverAssignmentBySessionViaPostgres(context: DriverAssignmentSessionContext): Promise<DriverAccessAssignment | null> {
  const sql = getPostgresClient();
  if (!sql) return null;

  const tokenRows = await sql<Row[]>`
    select id, project_id, assignment_id, driver_id, status, expires_at, metadata
    from driver_access_tokens
    where id = ${context.tokenId}
      and status = 'active'
    limit 1
  `;
  const tokenRow = tokenRows[0];
  if (!tokenRow?.project_id || !tokenRow.assignment_id || !tokenRow.driver_id) return null;
  if (tokenRow.expires_at && new Date(String(tokenRow.expires_at)).getTime() <= Date.now()) return null;
  if (
    String(tokenRow.project_id) !== context.projectId ||
    String(tokenRow.assignment_id) !== context.assignmentId ||
    String(tokenRow.driver_id) !== context.driverId
  ) {
    return null;
  }

  const assignmentRows = await sql<Row[]>`
    select * from assignments where id = ${context.assignmentId} limit 1
  `;
  const assignment = assignmentRows[0];
  if (!assignment) return null;
  if (text(assignment, "project_id") !== context.projectId || text(assignment, "driver_id") !== context.driverId) return null;

  const [projectRows, callSignRows, driverRows, vehicleRows, packetRows, notificationRows, routeChangeRows, messageRows, checkinRows, latestStatusRows] = await Promise.all([
    sql<Row[]>`select * from projects where id = ${context.projectId} limit 1`,
    sql<Row[]>`select * from call_signs where id = ${String(assignment.call_sign_id)} limit 1`,
    sql<Row[]>`select * from drivers where id = ${context.driverId} limit 1`,
    assignment.vehicle_id ? sql<Row[]>`select * from vehicles where id = ${String(assignment.vehicle_id)} limit 1` : Promise.resolve([]),
    sql<Row[]>`select payload from driver_assignment_packets where assignment_id = ${context.assignmentId} order by created_at desc limit 1`,
    sql<Row[]>`select * from driver_notifications where assignment_id = ${context.assignmentId} order by sent_at desc limit 10`,
    sql<Row[]>`select * from route_change_instructions where assignment_id = ${context.assignmentId} order by created_at desc limit 5`,
    sql<Row[]>`select id, message, created_at, issue_type, severity from driver_issue_reports where assignment_id = ${context.assignmentId} order by created_at asc limit 50`,
    sql<Row[]>`select id from driver_checkins where assignment_id = ${context.assignmentId} and status = 'ready' limit 1`,
    sql<Row[]>`select status, created_at from assignment_status_updates where assignment_id = ${context.assignmentId} order by created_at desc limit 1`
  ]);

  const project = projectRows[0];
  const callSign = callSignRows[0];
  const driver = driverRows[0];
  const vehicle = vehicleRows[0];
  if (!project || !callSign || !driver || !vehicle) return null;

  const operationAnchor = nullableText(assignment, "start_time") || new Date().toISOString();
  const dayAssignmentRows = await sql<Row[]>`
    select id, call_sign_id, start_time, end_time, status, metadata, created_at
    from assignments
    where project_id = ${context.projectId}
      and driver_id = ${context.driverId}
      and status <> 'cancelled'
    order by start_time asc nulls last, created_at asc
  `;
  const visibleDayRows = dayAssignmentRows.filter((row) => sameOperationDay(nullableText(row, "start_time"), operationAnchor));
  const dayCallSignIds = [...new Set(visibleDayRows.map((row) => text(row, "call_sign_id")).filter(Boolean))];
  const dayCallSignRows = dayCallSignIds.length ? await sql<Row[]>`select id, call_sign from call_signs where id in ${sql(dayCallSignIds)}` : [];
  const dayCallSignById = new Map(dayCallSignRows.map((row) => [text(row, "id"), text(row, "call_sign")]));
  const packetPayload = packetRows[0]?.payload;
  const tokenMeta = (tokenRow.metadata ?? {}) as Record<string, unknown>;

  return {
    token: "",
    tokenId: String(tokenRow.id),
    pinRequired: typeof tokenMeta.pinHash === "string" && tokenMeta.pinHash.length > 0,
    deviceBoundTo: typeof tokenMeta.deviceHash === "string" && tokenMeta.deviceHash ? tokenMeta.deviceHash : null,
    tokenValidated: true,
    packet: packetPayload && typeof packetPayload === "object" ? (packetPayload as DriverAssignmentPacket) : null,
    activated: checkinRows.length > 0,
    latestStatus: latestStatusRows[0] ? { status: text(latestStatusRows[0], "status"), at: text(latestStatusRows[0], "created_at") } : null,
    dayAssignments: buildDayAssignments(visibleDayRows, context.assignmentId, (id) => dayCallSignById.get(id)),
    messages: messageRows.map((row) => ({
      id: text(row, "id"),
      text: text(row, "message"),
      at: text(row, "created_at", new Date().toISOString()),
      issueType: text(row, "issue_type", "message"),
      severity: text(row, "severity", "info")
    })),
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

// Lean payload for the 15s poll on the driver task view. The full
// getDriverAssignmentByToken() rebuilds project + vehicle + driver + call sign
// + packet on every call (~15 queries); none of that changes during a job, so
// the poll only needs the handful of things that do.
export async function getDriverUpdatesByToken(token: string): Promise<DriverUpdates | null> {
  if (!token.startsWith("tomp_")) return null;
  const tokenHash = hashDriverAccessToken(token);

  const { client } = getSupabaseWriteClient();
  if (!client) return getDriverUpdatesByTokenViaPostgres(tokenHash);

  const { data: tokenRow } = await client
    .from("driver_access_tokens")
    .select("assignment_id, driver_id, project_id, status, expires_at")
    .eq("token_hash", tokenHash)
    .eq("status", "active")
    .maybeSingle();

  if (!tokenRow?.assignment_id || !tokenRow.driver_id || !tokenRow.project_id) return getDriverUpdatesByTokenViaPostgres(tokenHash);
  if (tokenRow.expires_at && new Date(String(tokenRow.expires_at)).getTime() <= Date.now()) return null;

  return getDriverUpdatesFor({
    projectId: String(tokenRow.project_id),
    assignmentId: String(tokenRow.assignment_id),
    driverId: String(tokenRow.driver_id)
  });
}

// Same lean payload, keyed by the ids a verified driver session already carries
// (no token lookup). This is the path the /api/driver/updates route uses.
export async function getDriverUpdatesFor({
  projectId,
  assignmentId,
  driverId
}: {
  projectId: string;
  assignmentId: string;
  driverId: string;
}): Promise<DriverUpdates | null> {
  const { client } = getSupabaseWriteClient();
  if (!client) {
    return getDriverUpdatesForViaPostgres(projectId, assignmentId, driverId);
  }

  const [{ data: assignmentRow }, notifications, messages, latestStatusRes, { data: dayRows }] = await Promise.all([
    client.from("assignments").select("status, start_time").eq("id", assignmentId).maybeSingle(),
    getDriverNotificationsByAssignmentId(assignmentId),
    getDriverIssueMessagesByAssignmentId(assignmentId),
    client.from("assignment_status_updates").select("status, created_at").eq("assignment_id", assignmentId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    client
      .from("assignments")
      .select("id, call_sign_id, start_time, end_time, status, metadata, created_at")
      .eq("project_id", projectId)
      .eq("driver_id", driverId)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true })
  ]);

  const operationAnchor = nullableText(assignmentRow as Row | null, "start_time") || new Date().toISOString();
  const visibleDayRows = ((dayRows || []) as Row[]).filter((row) => sameOperationDay(nullableText(row, "start_time"), operationAnchor));
  const dayCallSignIds = [...new Set(visibleDayRows.map((row) => text(row, "call_sign_id")).filter(Boolean))];
  const { data: dayCallSignRows } = dayCallSignIds.length
    ? await client.from("call_signs").select("id, call_sign").in("id", dayCallSignIds)
    : { data: [] as Row[] };
  const dayCallSignById = new Map(((dayCallSignRows || []) as Row[]).map((row) => [text(row, "id"), text(row, "call_sign")]));

  const latestStatusRow = latestStatusRes.data as Row | null;

  return {
    assignmentStatus: text(assignmentRow as Row | null, "status", "planned"),
    latestStatus: latestStatusRow ? { status: text(latestStatusRow, "status"), at: text(latestStatusRow, "created_at") } : null,
    notifications,
    messages,
    dayAssignments: buildDayAssignments(visibleDayRows, assignmentId, (id) => dayCallSignById.get(id))
  };
}

async function getDriverUpdatesByTokenViaPostgres(tokenHash: string): Promise<DriverUpdates | null> {
  const sql = getPostgresClient();
  if (!sql) return null;

  const tokenRows = await sql<Row[]>`
    select assignment_id, driver_id, project_id, expires_at
    from driver_access_tokens
    where token_hash = ${tokenHash} and status = 'active'
    limit 1
  `;
  const tokenRow = tokenRows[0];
  if (!tokenRow?.assignment_id || !tokenRow.driver_id || !tokenRow.project_id) return null;
  if (tokenRow.expires_at && new Date(String(tokenRow.expires_at)).getTime() <= Date.now()) return null;

  return getDriverUpdatesForViaPostgres(String(tokenRow.project_id), String(tokenRow.assignment_id), String(tokenRow.driver_id));
}

async function getDriverUpdatesForViaPostgres(projectId: string, assignmentId: string, driverId: string): Promise<DriverUpdates | null> {
  const sql = getPostgresClient();
  if (!sql) return null;

  const [assignmentRows, notifications, messages, latestStatusRows, dayRows] = await Promise.all([
    sql<Row[]>`select status, start_time from assignments where id = ${assignmentId} limit 1`,
    getDriverNotificationsByAssignmentId(assignmentId),
    getDriverIssueMessagesByAssignmentId(assignmentId),
    sql<Row[]>`select status, created_at from assignment_status_updates where assignment_id = ${assignmentId} order by created_at desc limit 1`,
    sql<Row[]>`
      select id, call_sign_id, start_time, end_time, status, metadata, created_at
      from assignments
      where project_id = ${projectId} and driver_id = ${driverId} and status <> 'cancelled'
      order by start_time asc nulls last, created_at asc
    `
  ]);

  const operationAnchor = nullableText(assignmentRows[0], "start_time") || new Date().toISOString();
  const visibleDayRows = dayRows.filter((row) => sameOperationDay(nullableText(row, "start_time"), operationAnchor));
  const dayCallSignIds = [...new Set(visibleDayRows.map((row) => text(row, "call_sign_id")).filter(Boolean))];
  const dayCallSignRows = dayCallSignIds.length ? await sql<Row[]>`select id, call_sign from call_signs where id in ${sql(dayCallSignIds)}` : [];
  const dayCallSignById = new Map(dayCallSignRows.map((row) => [text(row, "id"), text(row, "call_sign")]));

  return {
    assignmentStatus: text(assignmentRows[0], "status", "planned"),
    latestStatus: latestStatusRows[0] ? { status: text(latestStatusRows[0], "status"), at: text(latestStatusRows[0], "created_at") } : null,
    notifications,
    messages,
    dayAssignments: buildDayAssignments(visibleDayRows, assignmentId, (id) => dayCallSignById.get(id))
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
