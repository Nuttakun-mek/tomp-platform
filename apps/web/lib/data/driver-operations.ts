import type { DriverAssignmentPacket, DriverNotification, RouteChangeInstruction } from "@tomp/types/domain";
import { withTimeout } from "@/lib/async/timeout";
import { getPostgresClient } from "@/lib/db/postgres";
import { resolveReadClient } from "@/lib/supabase/scoped-client";

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
  const { client } = await resolveReadClient();
  if (!client) return getDriverAssignmentPacketByAssignmentIdViaPostgres(assignmentId);

  let data: { payload?: unknown } | null | undefined;
  let error: unknown;
  try {
    const result = await withTimeout(
      client.from("driver_assignment_packets").select("payload").eq("assignment_id", assignmentId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      1800,
      "driver assignment packet"
    );
    data = result.data as { payload?: unknown } | null;
    error = result.error;
  } catch {
    return getDriverAssignmentPacketByAssignmentIdViaPostgres(assignmentId);
  }

  if (error) return getDriverAssignmentPacketByAssignmentIdViaPostgres(assignmentId);
  const payload = data?.payload;
  return payload && typeof payload === "object" ? (payload as DriverAssignmentPacket) : getDriverAssignmentPacketByAssignmentIdViaPostgres(assignmentId);
}

export async function getDriverNotificationsByAssignmentId(assignmentId: string): Promise<DriverNotification[]> {
  const { client } = await resolveReadClient();
  if (!client) return getDriverNotificationsByAssignmentIdViaPostgres(assignmentId);

  let data: Row[] | null | undefined;
  let error: unknown;
  try {
    const result = await withTimeout(client.from("driver_notifications").select("*").eq("assignment_id", assignmentId).order("sent_at", { ascending: false }).limit(10), 1800, "driver notifications");
    data = result.data as Row[] | null;
    error = result.error;
  } catch {
    return getDriverNotificationsByAssignmentIdViaPostgres(assignmentId);
  }
  if (error || !data?.length) return getDriverNotificationsByAssignmentIdViaPostgres(assignmentId);
  return data.map(mapNotification);
}

// Notifications for many assignments in one query, grouped by assignment id.
// The vehicle-operations aggregation used to call the single-id version once
// per assignment.
export async function getDriverNotificationsByAssignmentIds(assignmentIds: readonly string[]): Promise<Map<string, DriverNotification[]>> {
  const ids = [...new Set(assignmentIds)].filter(Boolean);
  const grouped = new Map<string, DriverNotification[]>();
  if (!ids.length) return grouped;

  const push = (list: DriverNotification[]) => {
    for (const notification of list) {
      if (!notification.assignmentId) continue;
      const bucket = grouped.get(notification.assignmentId) ?? [];
      bucket.push(notification);
      grouped.set(notification.assignmentId, bucket);
    }
  };

  const { client } = await resolveReadClient();
  if (client) {
    try {
      const result = await withTimeout(
        client.from("driver_notifications").select("*").in("assignment_id", ids).order("sent_at", { ascending: false }),
        2200,
        "driver notifications (multi-assignment)"
      );
      if (!result.error && Array.isArray(result.data)) {
        push((result.data as Row[]).map(mapNotification));
        return grouped;
      }
    } catch {
      // fall through to the postgres path
    }
  }

  const rows = await Promise.all(ids.map((id) => getDriverNotificationsByAssignmentIdViaPostgres(id)));
  push(rows.flat());
  return grouped;
}

export interface DriverIssueMessage {
  id: string;
  text: string;
  at: string;
  issueType: string;
  severity: string;
}

function mapIssueMessage(row: Row): DriverIssueMessage {
  return {
    id: text(row, "id"),
    text: text(row, "message"),
    at: text(row, "created_at", new Date().toISOString()),
    issueType: text(row, "issue_type", "message"),
    severity: text(row, "severity", "info")
  };
}

// Driver -> control messages + issue reports for one assignment (for the driver's
// own chat thread on the QR page).
export async function getDriverIssueMessagesByAssignmentId(assignmentId: string): Promise<DriverIssueMessage[]> {
  const { client } = await resolveReadClient();
  if (client) {
    try {
      const result = await withTimeout(
        client.from("driver_issue_reports").select("id, message, created_at, issue_type, severity").eq("assignment_id", assignmentId).order("created_at", { ascending: true }).limit(50),
        1800,
        "driver issue messages"
      );
      if (!result.error && Array.isArray(result.data)) return (result.data as Row[]).map(mapIssueMessage);
    } catch {
      /* fall through */
    }
  }
  const sql = getPostgresClient();
  if (!sql) return [];
  try {
    const data = await sql<Row[]>`select id, message, created_at, issue_type, severity from driver_issue_reports where assignment_id = ${assignmentId} order by created_at asc limit 50`;
    return data.map(mapIssueMessage);
  } catch {
    return [];
  }
}

export async function getRouteChangesByAssignmentId(assignmentId: string): Promise<RouteChangeInstruction[]> {
  const { client } = await resolveReadClient();
  if (!client) return getRouteChangesByAssignmentIdViaPostgres(assignmentId);

  let data: Row[] | null | undefined;
  let error: unknown;
  try {
    const result = await withTimeout(client.from("route_change_instructions").select("*").eq("assignment_id", assignmentId).order("created_at", { ascending: false }).limit(5), 1800, "route changes");
    data = result.data as Row[] | null;
    error = result.error;
  } catch {
    return getRouteChangesByAssignmentIdViaPostgres(assignmentId);
  }
  if (error || !data?.length) return getRouteChangesByAssignmentIdViaPostgres(assignmentId);
  return data.map(mapRouteChange);
}

export async function getDriverOperationSummaryByProjectId(projectId: string): Promise<DriverOperationSummary> {
  const { client } = await resolveReadClient();
  if (!client) return getDriverOperationSummaryByProjectIdViaPostgres(projectId);

  let packets;
  let acknowledged;
  let notifications;
  let routeChanges;
  let sessions;
  try {
    [packets, acknowledged, notifications, routeChanges, sessions] = await withTimeout(
      Promise.all([
        client.from("driver_assignment_packets").select("id", { count: "exact", head: true }).eq("project_id", projectId),
        client.from("driver_assignment_packets").select("id", { count: "exact", head: true }).eq("project_id", projectId).not("acknowledged_at", "is", null),
        client.from("driver_notifications").select("id", { count: "exact", head: true }).eq("project_id", projectId).in("status", ["unread", "sent"]),
        client.from("route_change_instructions").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "pending"),
        client.from("driver_location_sessions").select("id,last_ping_at,status").eq("project_id", projectId).order("last_ping_at", { ascending: false }).limit(20)
      ]),
      2200,
      "driver operation summary"
    );
  } catch {
    return getDriverOperationSummaryByProjectIdViaPostgres(projectId);
  }

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
  try {
    const data = await sql<Row[]>`select payload from driver_assignment_packets where assignment_id = ${assignmentId} order by created_at desc limit 1`;
    const payload = data[0]?.payload;
    return payload && typeof payload === "object" ? (payload as DriverAssignmentPacket) : null;
  } catch {
    return null;
  }
}

async function getDriverNotificationsByAssignmentIdViaPostgres(assignmentId: string): Promise<DriverNotification[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  try {
    const data = await sql<Row[]>`select * from driver_notifications where assignment_id = ${assignmentId} order by sent_at desc limit 10`;
    return data.map(mapNotification);
  } catch {
    return [];
  }
}

async function getRouteChangesByAssignmentIdViaPostgres(assignmentId: string): Promise<RouteChangeInstruction[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  try {
    const data = await sql<Row[]>`select * from route_change_instructions where assignment_id = ${assignmentId} order by created_at desc limit 5`;
    return data.map(mapRouteChange);
  } catch {
    return [];
  }
}

async function getDriverOperationSummaryByProjectIdViaPostgres(projectId: string): Promise<DriverOperationSummary> {
  const sql = getPostgresClient();
  if (!sql) {
    return { packets: 0, acknowledgedPackets: 0, pendingNotifications: 0, pendingRouteChanges: 0, activeLocationSessions: 0, latestPingAt: null };
  }

  try {
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
  } catch {
    return { packets: 0, acknowledgedPackets: 0, pendingNotifications: 0, pendingRouteChanges: 0, activeLocationSessions: 0, latestPingAt: null };
  }
}
