import type { Assignment, CallSign, Driver, DriverAssignmentPacket, DriverNotification, Project, RouteChangeInstruction, Vehicle } from "@tomp/types/domain";
import { hashDriverAccessToken } from "@/lib/driver-access/token";
import { getDriverAssignmentPacketByAssignmentId, getDriverUnitThread, getRouteChangesByAssignmentId, type DriverIssueMessage } from "@/lib/data/driver-operations";
import { resolveDriverCurrentAssignment } from "@/lib/data/driver-current-assignment";
import { isUrgentMeta, orderDriverJobs } from "@/lib/domain/driver-day-order";
import { inWorkDay, workDayWindow } from "@/lib/domain/work-day";
import { getPostgresClient } from "@/lib/db/postgres";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

export interface DriverTokenIdentity {
  tokenId: string;
  projectId: string;
  assignmentId?: string | null;
  callSignId?: string | null;
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
      .select("id, project_id, assignment_id, call_sign_id, driver_id, status, expires_at, metadata")
      .eq("token_hash", tokenHash)
      .eq("status", "active")
      .maybeSingle();
    if (data) return identityFromRow(data as Record<string, unknown>);
  }

  const sql = getPostgresClient();
  if (!sql) return null;
  const rows = await sql<Array<Record<string, unknown>>>`
    select id, project_id, assignment_id, call_sign_id, driver_id, expires_at, metadata
    from driver_access_tokens where token_hash = ${tokenHash} and status = 'active' limit 1
  `;
  return rows[0] ? identityFromRow(rows[0]) : null;
}

function identityFromRow(row: Record<string, unknown>): DriverTokenIdentity | null {
  const assignmentId = typeof row.assignment_id === "string" ? row.assignment_id : null;
  const callSignId = typeof row.call_sign_id === "string" ? row.call_sign_id : null;
  const projectId = typeof row.project_id === "string" ? row.project_id : "";
  const driverId = typeof row.driver_id === "string" ? row.driver_id : "";
  if ((!assignmentId && !callSignId) || !projectId || !driverId) return null;
  const expiresAt = row.expires_at ? new Date(String(row.expires_at)).getTime() : 0;
  if (expiresAt && expiresAt <= Date.now()) return null;

  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    tokenId: String(row.id),
    projectId,
    assignmentId,
    callSignId,
    driverId,
    pinRequired: typeof meta.pinHash === "string" && meta.pinHash.length > 0,
    deviceBoundTo: typeof meta.deviceHash === "string" && meta.deviceHash ? meta.deviceHash : null
  };
}

export interface DriverUpdates {
  assignmentStatus: string;
  /** Which job these updates describe — re-resolved per poll, so it can move on from the page's job. */
  assignmentId: string;
  /** The job's own metadata (pickup, dropoff, time, ...), so a mid-job edit reaches a page that loads once. Null when the row could not be read. */
  assignmentMetadata: Record<string, unknown> | null;
  latestStatus: { status: string; at: string } | null;
  workSession: DriverWorkSessionState;
  dayAssignments: DriverDayAssignment[];
  notifications: DriverNotification[];
  messages: DriverIssueMessage[];
}

export interface DriverWorkSessionState {
  status: "not_started" | "active" | "ended";
  startedAt: string | null;
  endedAt: string | null;
  latestAt: string | null;
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
  workSession: DriverWorkSessionState;
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
  callSignId?: string | null;
  driverId: string;
}

type Row = Record<string, unknown>;
const WORK_SESSION_STATUSES = ["work_started", "work_ended"] as const;
// A clock-in belongs to the driver's working day, not to one job: closing a job
// and moving on to the next must not ask the driver to clock in again. So the
// session is read across every job of this driver in this project — but only
// within the current job's working day (lib/domain/work-day.ts), so an
// unclosed clock-in from yesterday is not "on duty" at this morning's start.
const WORK_SESSION_LOOKBACK_HOURS = 48;

function workSessionSince(now = Date.now()) {
  return new Date(now - WORK_SESSION_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
}
const TASK_STATUS_FILTER = ["acknowledged", "ready", "arrived_pickup", "passenger_onboard", "completed", "blocked"] as const;

function text(row: Row | null | undefined, key: string, fallback = "") {
  const value = row?.[key];
  return typeof value === "string" ? value : fallback;
}

function latestStatus(row: Row | null | undefined) {
  return row ? { status: text(row, "status"), at: text(row, "created_at") } : null;
}

function workSessionFromRows(rows: Row[] | null | undefined, anchor: string | null): DriverWorkSessionState {
  const day = workDayWindow(anchor);
  const sorted = (rows || [])
    .map((row) => ({ status: text(row, "status"), at: nullableText(row, "created_at") }))
    .filter((row): row is { status: string; at: string } => inWorkDay(row.at, day))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const latest = sorted[0] ?? null;
  const started = sorted.find((row) => row.status === "work_started") ?? null;
  const ended = sorted.find((row) => row.status === "work_ended") ?? null;
  const status = latest?.status === "work_started" ? "active" : latest?.status === "work_ended" ? "ended" : "not_started";
  return {
    status,
    startedAt: started?.at ?? null,
    // A clock-out from before the latest clock-in belongs to an earlier session.
    endedAt: ended && (!started || Date.parse(ended.at) >= Date.parse(started.at)) ? ended.at : null,
    latestAt: latest?.at ?? null
  };
}

// postgres.js returns timestamps as Date; supabase-js as ISO strings. Reading a
// Date as "no value" made the Postgres path treat every job as today's.
function nullableText(row: Row | null | undefined, key: string) {
  const value = row?.[key];
  if (value instanceof Date) return value.toISOString();
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

// The operation day is Bangkok's calendar day. getDate() is the server's day —
// UTC on Vercel — which put a 06:00 job on the previous day and asked the
// driver for the vehicle check again on the 08:00 job after it.
const operationDayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });

function sameOperationDay(value: string | null, anchor: string) {
  if (!value) return true;
  return operationDayFormat.format(new Date(value)) === operationDayFormat.format(new Date(anchor));
}

// Every job the unit holds in this project: the chat runs across them all, so
// a new job or a new day does not start the conversation over.
function unitJobIds(rows: Row[] | null | undefined) {
  return (rows || []).map((row) => text(row, "id")).filter(Boolean);
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
    .select("id, project_id, assignment_id, call_sign_id, driver_id, status, expires_at, metadata, usage_count")
    .eq("token_hash", tokenHash)
    .eq("status", "active")
    .maybeSingle();

  if (!tokenRow?.project_id || !tokenRow.driver_id || (tokenRow.expires_at && new Date(String(tokenRow.expires_at)).getTime() <= Date.now())) {
    return getDriverAssignmentByTokenViaPostgres(token, tokenHash);
  }

  const current = await resolveDriverCurrentAssignment({
    projectId: String(tokenRow.project_id),
    assignmentId: typeof tokenRow.assignment_id === "string" ? tokenRow.assignment_id : null,
    callSignId: typeof tokenRow.call_sign_id === "string" ? tokenRow.call_sign_id : null,
    driverId: String(tokenRow.driver_id)
  });
  if (!current) return getDriverAssignmentByTokenViaPostgres(token, tokenHash);

  const [{ data: project }, { data: assignment }] = await Promise.all([
    client.from("projects").select("*").eq("id", tokenRow.project_id).maybeSingle(),
    client.from("assignments").select("*").eq("id", current.id).maybeSingle()
  ]);

  if (!project || !assignment) {
    return getDriverAssignmentByTokenViaPostgres(token, tokenHash);
  }

  const [{ data: callSign }, { data: driver }, { data: vehicle }] = await Promise.all([
    client.from("call_signs").select("*").eq("id", assignment.call_sign_id).maybeSingle(),
    tokenRow.driver_id ? client.from("drivers").select("*").eq("id", tokenRow.driver_id).maybeSingle() : Promise.resolve({ data: null }),
    assignment.vehicle_id ? client.from("vehicles").select("*").eq("id", assignment.vehicle_id).maybeSingle() : Promise.resolve({ data: null })
  ]);

  if (!callSign || !driver || !vehicle) {
    return getDriverAssignmentByTokenViaPostgres(token, tokenHash);
  }

  // Usage telemetry — the real columns are last_used_at / usage_count. This
  // used to write last_accessed_at / used_at / access_count, which do not exist,
  // so every QR open failed silently and the counters never moved.
  const { error: usageError } = await client
    .from("driver_access_tokens")
    .update({
      last_used_at: new Date().toISOString(),
      usage_count: Number(tokenRow.usage_count ?? 0) + 1
    })
    .eq("token_hash", tokenHash);
  if (usageError) console.warn("driver token usage not recorded:", usageError.message);

  const [packet, routeChanges, checkinRes, latestStatusRes, workSessionRes] = await Promise.all([
    getDriverAssignmentPacketByAssignmentId(text(assignment, "id")),
    getRouteChangesByAssignmentId(text(assignment, "id")),
    client.from("driver_checkins").select("id").eq("assignment_id", text(assignment, "id")).eq("status", "ready").limit(1),
    client
      .from("assignment_status_updates")
      .select("status, created_at")
      .eq("assignment_id", text(assignment, "id"))
      .in("status", TASK_STATUS_FILTER)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("assignment_status_updates")
      .select("status, created_at")
      .eq("project_id", String(tokenRow.project_id))
      .eq("driver_id", String(tokenRow.driver_id))
      .in("status", WORK_SESSION_STATUSES)
      .gte("created_at", workSessionSince())
      .order("created_at", { ascending: false })
      .limit(20)
  ]);
  const currentAssignmentActivated = Boolean((checkinRes.data as unknown[] | null)?.length);
  const latestStatusRow = latestStatusRes.data as Row | null;
  const workSessionRows = (workSessionRes.data || []) as Row[];
  const operationAnchor = nullableText(assignment, "start_time") || new Date().toISOString();

  const { data: dayAssignmentRows } = await client
    .from("assignments")
    .select("id, call_sign_id, start_time, end_time, status, metadata, created_at")
    .eq("project_id", text(assignment, "project_id"))
    .eq("call_sign_id", text(assignment, "call_sign_id"))
    .neq("status", "cancelled")
    .order("start_time", { ascending: true });

  const visibleDayRows = ((dayAssignmentRows || []) as Row[]).filter((row) => sameOperationDay(nullableText(row, "start_time"), operationAnchor));
  const dayCallSignIds = [...new Set(visibleDayRows.map((row) => text(row, "call_sign_id")).filter(Boolean))];
  const { data: dayCallSignRows } = dayCallSignIds.length
    ? await client.from("call_signs").select("id, call_sign").in("id", dayCallSignIds)
    : { data: [] as Row[] };
  const dayCallSignById = new Map(((dayCallSignRows || []) as Row[]).map((row) => [text(row, "id"), text(row, "call_sign")]));
  const dayAssignments = buildDayAssignments(visibleDayRows, text(assignment, "id"), (id) => dayCallSignById.get(id));
  const visibleDayAssignmentIds = visibleDayRows.map((row) => text(row, "id")).filter(Boolean);
  const thread = await getDriverUnitThread([text(assignment, "id"), ...unitJobIds(dayAssignmentRows as Row[] | null)]);
  const { data: unitReadyRows } = !currentAssignmentActivated && visibleDayAssignmentIds.length
    ? await client
        .from("driver_checkins")
        .select("id")
        .eq("project_id", text(assignment, "project_id"))
        .eq("driver_id", String(tokenRow.driver_id))
        .eq("status", "ready")
        .in("assignment_id", visibleDayAssignmentIds)
        .limit(1)
    : { data: [] as Row[] };
  const activated = currentAssignmentActivated || Boolean((unitReadyRows as unknown[] | null)?.length);

  const tokenMeta = (tokenRow.metadata ?? {}) as Record<string, unknown>;

  return {
    token,
    tokenId: String(tokenRow.id),
    pinRequired: typeof tokenMeta.pinHash === "string" && tokenMeta.pinHash.length > 0,
    deviceBoundTo: typeof tokenMeta.deviceHash === "string" && tokenMeta.deviceHash ? tokenMeta.deviceHash : null,
    tokenValidated: true,
    packet,
    notifications: thread.notifications,
    routeChanges,
    messages: thread.messages,
    latestStatus: latestStatus(latestStatusRow),
    workSession: workSessionFromRows(workSessionRows, operationAnchor),
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
      driverId: nullableText(callSign, "driver_id"),
      vehicleId: nullableText(callSign, "vehicle_id"),
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
    .select("id, project_id, assignment_id, call_sign_id, driver_id, status, expires_at, metadata")
    .eq("id", context.tokenId)
    .eq("status", "active")
    .maybeSingle();

  if (!tokenRow || tokenRow.expires_at && new Date(String(tokenRow.expires_at)).getTime() <= Date.now()) {
    return getDriverAssignmentBySessionViaPostgres(context);
  }

  if (
    String(tokenRow.project_id) !== context.projectId ||
    (tokenRow.assignment_id && String(tokenRow.assignment_id) !== context.assignmentId && !tokenRow.call_sign_id) ||
    (tokenRow.call_sign_id && context.callSignId && String(tokenRow.call_sign_id) !== context.callSignId) ||
    String(tokenRow.driver_id) !== context.driverId
  ) {
    return null;
  }

  const current = await resolveDriverCurrentAssignment({
    projectId: context.projectId,
    assignmentId: context.assignmentId,
    callSignId: context.callSignId || (typeof tokenRow.call_sign_id === "string" ? tokenRow.call_sign_id : null),
    driverId: context.driverId
  });
  if (!current) return null;

  const [{ data: project }, { data: assignment }] = await Promise.all([
    client.from("projects").select("*").eq("id", context.projectId).maybeSingle(),
    client.from("assignments").select("*").eq("id", current.id).maybeSingle()
  ]);

  if (!project || !assignment) {
    return getDriverAssignmentBySessionViaPostgres(context);
  }

  const assignmentRow = assignment as Row;
  if (text(assignmentRow, "project_id") !== context.projectId || (text(assignmentRow, "driver_id") && text(assignmentRow, "driver_id") !== context.driverId)) {
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

  const [packet, routeChanges, checkinRes, latestStatusRes, workSessionRes] = await Promise.all([
    getDriverAssignmentPacketByAssignmentId(current.id),
    getRouteChangesByAssignmentId(current.id),
    client.from("driver_checkins").select("id").eq("assignment_id", current.id).eq("status", "ready").limit(1),
    client
      .from("assignment_status_updates")
      .select("status, created_at")
      .eq("assignment_id", current.id)
      .in("status", TASK_STATUS_FILTER)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("assignment_status_updates")
      .select("status, created_at")
      .eq("project_id", context.projectId)
      .eq("driver_id", context.driverId)
      .in("status", WORK_SESSION_STATUSES)
      .gte("created_at", workSessionSince())
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  const operationAnchor = nullableText(assignmentRow, "start_time") || new Date().toISOString();
  const { data: dayAssignmentRows } = await client
    .from("assignments")
    .select("id, call_sign_id, start_time, end_time, status, metadata, created_at")
    .eq("project_id", context.projectId)
    .eq("call_sign_id", text(assignmentRow, "call_sign_id"))
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
  const workSessionRows = (workSessionRes.data || []) as Row[];
  const currentAssignmentActivated = Boolean((checkinRes.data as unknown[] | null)?.length);
  const visibleDayAssignmentIds = visibleDayRows.map((row) => text(row, "id")).filter(Boolean);
  const thread = await getDriverUnitThread([current.id, ...unitJobIds(dayAssignmentRows as Row[] | null)]);
  const { data: unitReadyRows } = !currentAssignmentActivated && visibleDayAssignmentIds.length
    ? await client
        .from("driver_checkins")
        .select("id")
        .eq("project_id", context.projectId)
        .eq("driver_id", context.driverId)
        .eq("status", "ready")
        .in("assignment_id", visibleDayAssignmentIds)
        .limit(1)
    : { data: [] as Row[] };

  return {
    token: "",
    tokenId: String(tokenRow.id),
    pinRequired: typeof tokenMeta.pinHash === "string" && tokenMeta.pinHash.length > 0,
    deviceBoundTo: typeof tokenMeta.deviceHash === "string" && tokenMeta.deviceHash ? tokenMeta.deviceHash : null,
    tokenValidated: true,
    packet,
    notifications: thread.notifications,
    routeChanges,
    messages: thread.messages,
    latestStatus: latestStatus(latestStatusRow),
    workSession: workSessionFromRows(workSessionRows, operationAnchor),
    dayAssignments: buildDayAssignments(visibleDayRows, current.id, (id) => dayCallSignById.get(id)),
    activated: currentAssignmentActivated || Boolean((unitReadyRows as unknown[] | null)?.length),
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
      driverId: nullableText(callSign as Row, "driver_id"),
      vehicleId: nullableText(callSign as Row, "vehicle_id"),
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
    select id, project_id, assignment_id, call_sign_id, driver_id, status, expires_at, metadata
    from driver_access_tokens
    where token_hash = ${tokenHash}
      and status = 'active'
    limit 1
  `;
  const tokenRow = tokenRows[0];
  if (!tokenRow?.project_id || !tokenRow.driver_id) return null;
  if (tokenRow.expires_at && new Date(String(tokenRow.expires_at)).getTime() <= Date.now()) return null;

  const current = await resolveDriverCurrentAssignment({
    projectId: String(tokenRow.project_id),
    assignmentId: nullableText(tokenRow, "assignment_id"),
    callSignId: nullableText(tokenRow, "call_sign_id"),
    driverId: String(tokenRow.driver_id)
  });
  if (!current) return null;

  const assignmentRows = await sql<Row[]>`
    select * from assignments where id = ${current.id} limit 1
  `;
  const assignment = assignmentRows[0];
  if (!assignment) return null;

  const [projectRows, callSignRows, driverRows, vehicleRows, packetRows, routeChangeRows, checkinRows, latestStatusRows, workSessionRows] = await Promise.all([
    sql<Row[]>`select * from projects where id = ${String(tokenRow.project_id)} limit 1`,
    sql<Row[]>`select * from call_signs where id = ${String(assignment.call_sign_id)} limit 1`,
    tokenRow.driver_id ? sql<Row[]>`select * from drivers where id = ${String(tokenRow.driver_id)} limit 1` : Promise.resolve([]),
    assignment.vehicle_id ? sql<Row[]>`select * from vehicles where id = ${String(assignment.vehicle_id)} limit 1` : Promise.resolve([]),
    sql<Row[]>`select payload from driver_assignment_packets where assignment_id = ${current.id} order by created_at desc limit 1`,
    sql<Row[]>`select * from route_change_instructions where assignment_id = ${current.id} order by created_at desc limit 5`,
    sql<Row[]>`select id from driver_checkins where assignment_id = ${current.id} and status = 'ready' limit 1`,
    sql<Row[]>`select status, created_at from assignment_status_updates where assignment_id = ${current.id} and status not in ('work_started', 'work_ended') order by created_at desc limit 1`,
    sql<Row[]>`select status, created_at from assignment_status_updates where project_id = ${String(tokenRow.project_id)} and driver_id = ${String(tokenRow.driver_id)} and status in ('work_started', 'work_ended') and created_at >= ${workSessionSince()} order by created_at desc limit 20`
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
      and call_sign_id = ${String(assignment.call_sign_id)}
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
  const currentAssignmentActivated = checkinRows.length > 0;
  const visibleDayAssignmentIds = visibleDayRows.map((row) => text(row, "id")).filter(Boolean);
  const thread = await getDriverUnitThread([current.id, ...unitJobIds(dayAssignmentRows as Row[] | null)]);
  const unitReadyRows = !currentAssignmentActivated && visibleDayAssignmentIds.length
    ? await sql<Row[]>`
        select id from driver_checkins
        where project_id = ${String(tokenRow.project_id)}
          and driver_id = ${String(tokenRow.driver_id)}
          and status = 'ready'
          and assignment_id in ${sql(visibleDayAssignmentIds)}
        limit 1
      `
    : [];

  await sql`
    update driver_access_tokens
    set last_used_at = now(),
        usage_count = coalesce(usage_count, 0) + 1
    where token_hash = ${tokenHash}
  `.catch(() => undefined);

  const packetPayload = packetRows[0]?.payload;
  const pgTokenMeta = (tokenRow.metadata ?? {}) as Record<string, unknown>;

  return {
    tokenId: String(tokenRow.id),
    pinRequired: typeof pgTokenMeta.pinHash === "string" && pgTokenMeta.pinHash.length > 0,
    deviceBoundTo: typeof pgTokenMeta.deviceHash === "string" && pgTokenMeta.deviceHash ? pgTokenMeta.deviceHash : null,
    token,
    tokenValidated: true,
    packet: packetPayload && typeof packetPayload === "object" ? (packetPayload as DriverAssignmentPacket) : null,
    activated: currentAssignmentActivated || unitReadyRows.length > 0,
    latestStatus: latestStatus(latestStatusRows[0]),
    workSession: workSessionFromRows(workSessionRows, operationAnchor),
    dayAssignments,
    messages: thread.messages,
    notifications: thread.notifications,
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
      driverId: nullableText(callSign, "driver_id"),
      vehicleId: nullableText(callSign, "vehicle_id"),
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
    select id, project_id, assignment_id, call_sign_id, driver_id, status, expires_at, metadata
    from driver_access_tokens
    where id = ${context.tokenId}
      and status = 'active'
    limit 1
  `;
  const tokenRow = tokenRows[0];
  if (!tokenRow?.project_id || !tokenRow.driver_id) return null;
  if (tokenRow.expires_at && new Date(String(tokenRow.expires_at)).getTime() <= Date.now()) return null;
  if (
    String(tokenRow.project_id) !== context.projectId ||
    (tokenRow.assignment_id && String(tokenRow.assignment_id) !== context.assignmentId && !tokenRow.call_sign_id) ||
    (tokenRow.call_sign_id && context.callSignId && String(tokenRow.call_sign_id) !== context.callSignId) ||
    String(tokenRow.driver_id) !== context.driverId
  ) {
    return null;
  }

  const current = await resolveDriverCurrentAssignment({
    projectId: context.projectId,
    assignmentId: context.assignmentId,
    callSignId: context.callSignId || nullableText(tokenRow, "call_sign_id"),
    driverId: context.driverId
  });
  if (!current) return null;

  const assignmentRows = await sql<Row[]>`
    select * from assignments where id = ${current.id} limit 1
  `;
  const assignment = assignmentRows[0];
  if (!assignment) return null;
  if (text(assignment, "project_id") !== context.projectId || (text(assignment, "driver_id") && text(assignment, "driver_id") !== context.driverId)) return null;

  const [projectRows, callSignRows, driverRows, vehicleRows, packetRows, routeChangeRows, checkinRows, latestStatusRows, workSessionRows] = await Promise.all([
    sql<Row[]>`select * from projects where id = ${context.projectId} limit 1`,
    sql<Row[]>`select * from call_signs where id = ${String(assignment.call_sign_id)} limit 1`,
    sql<Row[]>`select * from drivers where id = ${context.driverId} limit 1`,
    assignment.vehicle_id ? sql<Row[]>`select * from vehicles where id = ${String(assignment.vehicle_id)} limit 1` : Promise.resolve([]),
    sql<Row[]>`select payload from driver_assignment_packets where assignment_id = ${current.id} order by created_at desc limit 1`,
    sql<Row[]>`select * from route_change_instructions where assignment_id = ${current.id} order by created_at desc limit 5`,
    sql<Row[]>`select id from driver_checkins where assignment_id = ${current.id} and status = 'ready' limit 1`,
    sql<Row[]>`select status, created_at from assignment_status_updates where assignment_id = ${current.id} and status not in ('work_started', 'work_ended') order by created_at desc limit 1`,
    sql<Row[]>`select status, created_at from assignment_status_updates where project_id = ${context.projectId} and driver_id = ${context.driverId} and status in ('work_started', 'work_ended') and created_at >= ${workSessionSince()} order by created_at desc limit 20`
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
      and call_sign_id = ${String(assignment.call_sign_id)}
      and status <> 'cancelled'
    order by start_time asc nulls last, created_at asc
  `;
  const visibleDayRows = dayAssignmentRows.filter((row) => sameOperationDay(nullableText(row, "start_time"), operationAnchor));
  const dayCallSignIds = [...new Set(visibleDayRows.map((row) => text(row, "call_sign_id")).filter(Boolean))];
  const dayCallSignRows = dayCallSignIds.length ? await sql<Row[]>`select id, call_sign from call_signs where id in ${sql(dayCallSignIds)}` : [];
  const dayCallSignById = new Map(dayCallSignRows.map((row) => [text(row, "id"), text(row, "call_sign")]));
  const packetPayload = packetRows[0]?.payload;
  const tokenMeta = (tokenRow.metadata ?? {}) as Record<string, unknown>;
  const currentAssignmentActivated = checkinRows.length > 0;
  const visibleDayAssignmentIds = visibleDayRows.map((row) => text(row, "id")).filter(Boolean);
  const thread = await getDriverUnitThread([current.id, ...unitJobIds(dayAssignmentRows as Row[] | null)]);
  const unitReadyRows = !currentAssignmentActivated && visibleDayAssignmentIds.length
    ? await sql<Row[]>`
        select id from driver_checkins
        where project_id = ${context.projectId}
          and driver_id = ${context.driverId}
          and status = 'ready'
          and assignment_id in ${sql(visibleDayAssignmentIds)}
        limit 1
      `
    : [];

  return {
    token: "",
    tokenId: String(tokenRow.id),
    pinRequired: typeof tokenMeta.pinHash === "string" && tokenMeta.pinHash.length > 0,
    deviceBoundTo: typeof tokenMeta.deviceHash === "string" && tokenMeta.deviceHash ? tokenMeta.deviceHash : null,
    tokenValidated: true,
    packet: packetPayload && typeof packetPayload === "object" ? (packetPayload as DriverAssignmentPacket) : null,
    activated: currentAssignmentActivated || unitReadyRows.length > 0,
    latestStatus: latestStatus(latestStatusRows[0]),
    workSession: workSessionFromRows(workSessionRows, operationAnchor),
    dayAssignments: buildDayAssignments(visibleDayRows, current.id, (id) => dayCallSignById.get(id)),
    messages: thread.messages,
    notifications: thread.notifications,
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
      driverId: nullableText(callSign, "driver_id"),
      vehicleId: nullableText(callSign, "vehicle_id"),
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
    .select("assignment_id, call_sign_id, driver_id, project_id, status, expires_at")
    .eq("token_hash", tokenHash)
    .eq("status", "active")
    .maybeSingle();

  if (!tokenRow?.driver_id || !tokenRow.project_id) return getDriverUpdatesByTokenViaPostgres(tokenHash);
  if (tokenRow.expires_at && new Date(String(tokenRow.expires_at)).getTime() <= Date.now()) return null;

  const current = await resolveDriverCurrentAssignment({
    projectId: String(tokenRow.project_id),
    assignmentId: typeof tokenRow.assignment_id === "string" ? tokenRow.assignment_id : null,
    callSignId: typeof tokenRow.call_sign_id === "string" ? tokenRow.call_sign_id : null,
    driverId: String(tokenRow.driver_id)
  });
  if (!current) return null;

  return getDriverUpdatesFor({
    projectId: String(tokenRow.project_id),
    assignmentId: current.id,
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

  const [{ data: assignmentRow }, latestStatusRes, workSessionRes] = await Promise.all([
    client.from("assignments").select("status, start_time, call_sign_id, metadata").eq("id", assignmentId).maybeSingle(),
    client.from("assignment_status_updates").select("status, created_at").eq("assignment_id", assignmentId).in("status", TASK_STATUS_FILTER).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    client.from("assignment_status_updates").select("status, created_at").eq("project_id", projectId).eq("driver_id", driverId).in("status", WORK_SESSION_STATUSES).gte("created_at", workSessionSince()).order("created_at", { ascending: false }).limit(20)
  ]);
  const assignmentCallSignId = text(assignmentRow as Row | null, "call_sign_id");
  const { data: dayRows } = await client
    .from("assignments")
    .select("id, call_sign_id, start_time, end_time, status, metadata, created_at")
    .eq("project_id", projectId)
    .eq(assignmentCallSignId ? "call_sign_id" : "driver_id", assignmentCallSignId || driverId)
    .neq("status", "cancelled")
    .order("start_time", { ascending: true });

  const operationAnchor = nullableText(assignmentRow as Row | null, "start_time") || new Date().toISOString();
  const visibleDayRows = ((dayRows || []) as Row[]).filter((row) => sameOperationDay(nullableText(row, "start_time"), operationAnchor));
  const { notifications, messages } = await getDriverUnitThread([assignmentId, ...unitJobIds(dayRows as Row[] | null)]);
  const dayCallSignIds = [...new Set(visibleDayRows.map((row) => text(row, "call_sign_id")).filter(Boolean))];
  const { data: dayCallSignRows } = dayCallSignIds.length
    ? await client.from("call_signs").select("id, call_sign").in("id", dayCallSignIds)
    : { data: [] as Row[] };
  const dayCallSignById = new Map(((dayCallSignRows || []) as Row[]).map((row) => [text(row, "id"), text(row, "call_sign")]));

  const latestStatusRow = latestStatusRes.data as Row | null;

  return {
    assignmentStatus: text(assignmentRow as Row | null, "status", "planned"),
    assignmentId,
    assignmentMetadata: assignmentRow ? metadata(assignmentRow as Row) : null,
    latestStatus: latestStatus(latestStatusRow),
    workSession: workSessionFromRows((workSessionRes.data || []) as Row[], operationAnchor),
    notifications,
    messages,
    dayAssignments: buildDayAssignments(visibleDayRows, assignmentId, (id) => dayCallSignById.get(id))
  };
}

async function getDriverUpdatesByTokenViaPostgres(tokenHash: string): Promise<DriverUpdates | null> {
  const sql = getPostgresClient();
  if (!sql) return null;

  const tokenRows = await sql<Row[]>`
    select assignment_id, call_sign_id, driver_id, project_id, expires_at
    from driver_access_tokens
    where token_hash = ${tokenHash} and status = 'active'
    limit 1
  `;
  const tokenRow = tokenRows[0];
  if (!tokenRow?.driver_id || !tokenRow.project_id) return null;
  if (tokenRow.expires_at && new Date(String(tokenRow.expires_at)).getTime() <= Date.now()) return null;

  const current = await resolveDriverCurrentAssignment({
    projectId: String(tokenRow.project_id),
    assignmentId: nullableText(tokenRow, "assignment_id"),
    callSignId: nullableText(tokenRow, "call_sign_id"),
    driverId: String(tokenRow.driver_id)
  });
  if (!current) return null;

  return getDriverUpdatesForViaPostgres(String(tokenRow.project_id), current.id, String(tokenRow.driver_id));
}

async function getDriverUpdatesForViaPostgres(projectId: string, assignmentId: string, driverId: string): Promise<DriverUpdates | null> {
  const sql = getPostgresClient();
  if (!sql) return null;

  const [assignmentRows, latestStatusRows, workSessionRows] = await Promise.all([
    sql<Row[]>`select status, start_time, call_sign_id, metadata from assignments where id = ${assignmentId} limit 1`,
    sql<Row[]>`select status, created_at from assignment_status_updates where assignment_id = ${assignmentId} and status not in ('work_started', 'work_ended') order by created_at desc limit 1`,
    sql<Row[]>`select status, created_at from assignment_status_updates where project_id = ${projectId} and driver_id = ${driverId} and status in ('work_started', 'work_ended') and created_at >= ${workSessionSince()} order by created_at desc limit 20`
  ]);

  const assignmentCallSignId = nullableText(assignmentRows[0], "call_sign_id");
  const dayRows = assignmentCallSignId
    ? await sql<Row[]>`
      select id, call_sign_id, start_time, end_time, status, metadata, created_at
      from assignments
      where project_id = ${projectId} and call_sign_id = ${assignmentCallSignId} and status <> 'cancelled'
      order by start_time asc nulls last, created_at asc
    `
    : await sql<Row[]>`
      select id, call_sign_id, start_time, end_time, status, metadata, created_at
      from assignments
      where project_id = ${projectId} and driver_id = ${driverId} and status <> 'cancelled'
      order by start_time asc nulls last, created_at asc
    `;

  const operationAnchor = nullableText(assignmentRows[0], "start_time") || new Date().toISOString();
  const visibleDayRows = dayRows.filter((row) => sameOperationDay(nullableText(row, "start_time"), operationAnchor));
  const { notifications, messages } = await getDriverUnitThread([assignmentId, ...unitJobIds(dayRows as Row[] | null)]);
  const dayCallSignIds = [...new Set(visibleDayRows.map((row) => text(row, "call_sign_id")).filter(Boolean))];
  const dayCallSignRows = dayCallSignIds.length ? await sql<Row[]>`select id, call_sign from call_signs where id in ${sql(dayCallSignIds)}` : [];
  const dayCallSignById = new Map(dayCallSignRows.map((row) => [text(row, "id"), text(row, "call_sign")]));

  return {
    assignmentStatus: text(assignmentRows[0], "status", "planned"),
    assignmentId,
    assignmentMetadata: assignmentRows[0] ? metadata(assignmentRows[0]) : null,
    latestStatus: latestStatus(latestStatusRows[0]),
    workSession: workSessionFromRows(workSessionRows, operationAnchor),
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

export interface DriverWaitingContext {
  tokenId: string;
  projectId: string;
  projectName: string;
  callSign: string;
  driverName: string;
  vehicleLabel: string;
  pinRequired: boolean;
  deviceBoundTo: string | null;
}

/**
 * The unit is crewed and its QR is valid — there is simply no work on it yet.
 *
 * That is now the ordinary state of a brand new unit: crewing issues the QR
 * immediately, so a driver can be holding a printed sheet before anyone has
 * planned their day. Without this the page could only say "ไม่พบงานสำหรับ
 * ลิงก์นี้", which reads as a broken QR and sends the driver back to the control
 * room over something that is working correctly.
 *
 * Returns null when the token really is unusable, so the caller can still tell
 * the two apart.
 */
export async function getDriverWaitingContext(token: string): Promise<DriverWaitingContext | null> {
  const identity = await resolveDriverTokenIdentity(token);
  if (!identity || !identity.callSignId) return null;

  const { client } = getSupabaseWriteClient();
  if (!client) return null;

  const [{ data: project }, { data: callSign }, { data: driver }] = await Promise.all([
    client.from("projects").select("project_name").eq("id", identity.projectId).maybeSingle(),
    client.from("call_signs").select("call_sign, vehicle_id").eq("id", identity.callSignId).maybeSingle(),
    client.from("drivers").select("full_name").eq("id", identity.driverId).maybeSingle()
  ]);

  const vehicleId = typeof callSign?.vehicle_id === "string" ? callSign.vehicle_id : null;
  const { data: vehicle } = vehicleId
    ? await client.from("vehicles").select("plate_number, vehicle_type").eq("id", vehicleId).maybeSingle()
    : { data: null };

  return {
    tokenId: identity.tokenId,
    projectId: identity.projectId,
    projectName: text(project, "project_name", "โครงการ"),
    callSign: text(callSign, "call_sign", "หน่วยรถ"),
    driverName: text(driver, "full_name", "คนขับ"),
    vehicleLabel: vehicle ? `${text(vehicle, "plate_number")} · ${text(vehicle, "vehicle_type")}` : "ยังไม่ผูกรถ",
    pinRequired: identity.pinRequired,
    deviceBoundTo: identity.deviceBoundTo
  };
}
