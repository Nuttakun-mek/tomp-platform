import type { DriverAssignmentPacket, DriverNotification, RouteChangeInstruction } from "@tomp/types/domain";
import { getPostgresClient } from "@/lib/db/postgres";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

function text(row: Row, key: string, fallback = "") {
  const value = row[key];
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : fallback;
}

function metadata(row: Row) {
  const value = row.metadata;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function mapNotification(row: Row): DriverNotification {
  return {
    id: text(row, "id"),
    projectId: text(row, "project_id"),
    assignmentId: text(row, "assignment_id") || null,
    driverId: text(row, "driver_id") || null,
    notificationType: text(row, "notification_type"),
    priority: text(row, "priority", "normal") as DriverNotification["priority"],
    title: text(row, "title"),
    body: text(row, "body"),
    action: "acknowledge",
    actionLabel: text(row, "action_label") || null,
    actionUrl: text(row, "action_url") || null,
    status: text(row, "status", "unread") as DriverNotification["status"],
    createdAt: text(row, "sent_at", text(row, "created_at", new Date().toISOString())),
    expiresAt: text(row, "expires_at") || null,
    metadata: metadata(row)
  };
}

function mapRouteChange(row: Row): RouteChangeInstruction {
  return {
    id: text(row, "id"),
    assignmentId: text(row, "assignment_id"),
    reason: text(row, "reason"),
    impactSummary: text(row, "impact_summary") || null,
    oldRoute: row.old_route && typeof row.old_route === "object" ? (row.old_route as RouteChangeInstruction["oldRoute"]) : null,
    newRoute: row.new_route && typeof row.new_route === "object" ? (row.new_route as RouteChangeInstruction["newRoute"]) : { summary: "เส้นทางที่ศูนย์ควบคุมแจ้ง", stops: [], metadata: {} },
    status: text(row, "status", "pending") as RouteChangeInstruction["status"]
  };
}

export interface DriverOperationSummary {
  packets: number;
  acknowledgedPackets: number;
  pendingNotifications: number;
  pendingRouteChanges: number;
  activeLocationSessions: number;
  latestPingAt: string | null;
}

export async function getDriverAssignmentPacketByAssignmentId(assignmentId: string): Promise<DriverAssignmentPacket | null> {
  const client = getSupabaseServerDataClient();
  if (!client) return getDriverAssignmentPacketByAssignmentIdViaPostgres(assignmentId);

  const { data, error } = await client
    .from("driver_assignment_packets")
    .select("payload")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return getDriverAssignmentPacketByAssignmentIdViaPostgres(assignmentId);
  const payload = data?.payload;
  return payload && typeof payload === "object" ? (payload as DriverAssignmentPacket) : getDriverAssignmentPacketByAssignmentIdViaPostgres(assignmentId);
}

export async function getDriverNotificationsByAssignmentId(assignmentId: string): Promise<DriverNotification[]> {
  const client = getSupabaseServerDataClient();
  if (!client) return getDriverNotificationsByAssignmentIdViaPostgres(assignmentId);

  const { data, error } = await client.from("driver_notifications").select("*").eq("assignment_id", assignmentId).order("sent_at", { ascending: false }).limit(10);
  if (error || !data?.length) return getDriverNotificationsByAssignmentIdViaPostgres(assignmentId);
  return data.map(mapNotification);
}

export async function getRouteChangesByAssignmentId(assignmentId: string): Promise<RouteChangeInstruction[]> {
  const client = getSupabaseServerDataClient();
  if (!client) return getRouteChangesByAssignmentIdViaPostgres(assignmentId);

  const { data, error } = await client.from("route_change_instructions").select("*").eq("assignment_id", assignmentId).order("created_at", { ascending: false }).limit(5);
  if (error || !data?.length) return getRouteChangesByAssignmentIdViaPostgres(assignmentId);
  return data.map(mapRouteChange);
}

export async function getDriverOperationSummaryByProjectId(projectId: string): Promise<DriverOperationSummary> {
  const client = getSupabaseServerDataClient();
  if (!client) return getDriverOperationSummaryByProjectIdViaPostgres(projectId);

  const [packets, acknowledged, notifications, routeChanges, sessions] = await Promise.all([
    client.from("driver_assignment_packets").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    client.from("driver_assignment_packets").select("id", { count: "exact", head: true }).eq("project_id", projectId).not("acknowledged_at", "is", null),
    client.from("driver_notifications").select("id", { count: "exact", head: true }).eq("project_id", projectId).in("status", ["unread", "sent"]),
    client.from("route_change_instructions").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "pending"),
    client.from("driver_location_sessions").select("id,last_ping_at,status").eq("project_id", projectId).order("last_ping_at", { ascending: false }).limit(20)
  ]);

  if (packets.error || acknowledged.error || notifications.error || routeChanges.error || sessions.error) {
    return getDriverOperationSummaryByProjectIdViaPostgres(projectId);
  }

  const sessionRows = (sessions.data || []) as Row[];
  return {
    packets: packets.count || 0,
    acknowledgedPackets: acknowledged.count || 0,
    pendingNotifications: notifications.count || 0,
    pendingRouteChanges: routeChanges.count || 0,
    activeLocationSessions: sessionRows.filter((row) => text(row, "status") === "healthy" || text(row, "status") === "active").length,
    latestPingAt: sessionRows.length ? text(sessionRows[0], "last_ping_at") || null : null
  };
}

async function getDriverAssignmentPacketByAssignmentIdViaPostgres(assignmentId: string): Promise<DriverAssignmentPacket | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const data = await sql<Row[]>`select payload from driver_assignment_packets where assignment_id = ${assignmentId} order by created_at desc limit 1`;
  const payload = data[0]?.payload;
  return payload && typeof payload === "object" ? (payload as DriverAssignmentPacket) : null;
}

async function getDriverNotificationsByAssignmentIdViaPostgres(assignmentId: string): Promise<DriverNotification[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  const data = await sql<Row[]>`select * from driver_notifications where assignment_id = ${assignmentId} order by sent_at desc limit 10`;
  return data.map(mapNotification);
}

async function getRouteChangesByAssignmentIdViaPostgres(assignmentId: string): Promise<RouteChangeInstruction[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  const data = await sql<Row[]>`select * from route_change_instructions where assignment_id = ${assignmentId} order by created_at desc limit 5`;
  return data.map(mapRouteChange);
}

async function getDriverOperationSummaryByProjectIdViaPostgres(projectId: string): Promise<DriverOperationSummary> {
  const sql = getPostgresClient();
  if (!sql) {
    return { packets: 0, acknowledgedPackets: 0, pendingNotifications: 0, pendingRouteChanges: 0, activeLocationSessions: 0, latestPingAt: null };
  }

  const [packets, acknowledged, notifications, routeChanges, sessions] = await Promise.all([
    sql<Array<{ count: string }>>`select count(*)::text as count from driver_assignment_packets where project_id = ${projectId}`,
    sql<Array<{ count: string }>>`select count(*)::text as count from driver_assignment_packets where project_id = ${projectId} and acknowledged_at is not null`,
    sql<Array<{ count: string }>>`select count(*)::text as count from driver_notifications where project_id = ${projectId} and status in ('unread', 'sent')`,
    sql<Array<{ count: string }>>`select count(*)::text as count from route_change_instructions where project_id = ${projectId} and status = 'pending'`,
    sql<Row[]>`select id,last_ping_at,status from driver_location_sessions where project_id = ${projectId} order by last_ping_at desc limit 20`
  ]);

  return {
    packets: Number(packets[0]?.count || 0),
    acknowledgedPackets: Number(acknowledged[0]?.count || 0),
    pendingNotifications: Number(notifications[0]?.count || 0),
    pendingRouteChanges: Number(routeChanges[0]?.count || 0),
    activeLocationSessions: sessions.filter((row) => text(row, "status") === "healthy" || text(row, "status") === "active").length,
    latestPingAt: sessions.length ? text(sessions[0], "last_ping_at") || null : null
  };
}
