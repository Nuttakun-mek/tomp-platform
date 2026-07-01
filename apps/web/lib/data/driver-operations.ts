import type { DriverAssignmentPacket, DriverNotification, RouteChangeInstruction } from "@tomp/types/domain";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

function text(row: Row, key: string, fallback = "") {
  const value = row[key];
  return typeof value === "string" ? value : fallback;
}

function metadata(row: Row) {
  const value = row.metadata;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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
  if (!client) return null;
  const { data } = await client
    .from("driver_assignment_packets")
    .select("payload")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const payload = data?.payload;
  return payload && typeof payload === "object" ? (payload as DriverAssignmentPacket) : null;
}

export async function getDriverNotificationsByAssignmentId(assignmentId: string): Promise<DriverNotification[]> {
  const client = getSupabaseServerDataClient();
  if (!client) return [];
  const { data } = await client.from("driver_notifications").select("*").eq("assignment_id", assignmentId).order("sent_at", { ascending: false }).limit(10);
  return (data || []).map((row) => ({
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
    createdAt: text(row, "sent_at", new Date().toISOString()),
    expiresAt: text(row, "expires_at") || null,
    metadata: metadata(row)
  }));
}

export async function getRouteChangesByAssignmentId(assignmentId: string): Promise<RouteChangeInstruction[]> {
  const client = getSupabaseServerDataClient();
  if (!client) return [];
  const { data } = await client.from("route_change_instructions").select("*").eq("assignment_id", assignmentId).order("created_at", { ascending: false }).limit(5);
  return (data || []).map((row) => ({
    id: text(row, "id"),
    assignmentId: text(row, "assignment_id"),
    reason: text(row, "reason"),
    impactSummary: text(row, "impact_summary") || null,
    oldRoute: null,
    newRoute: { summary: "เส้นทางที่ศูนย์ควบคุมแจ้ง", stops: [], metadata: {} },
    status: text(row, "status", "pending") as RouteChangeInstruction["status"]
  }));
}

export async function getDriverOperationSummaryByProjectId(projectId: string): Promise<DriverOperationSummary> {
  const client = getSupabaseServerDataClient();
  if (!client) {
    return { packets: 0, acknowledgedPackets: 0, pendingNotifications: 0, pendingRouteChanges: 0, activeLocationSessions: 0, latestPingAt: null };
  }

  const [packets, acknowledged, notifications, routeChanges, sessions] = await Promise.all([
    client.from("driver_assignment_packets").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    client.from("driver_assignment_packets").select("id", { count: "exact", head: true }).eq("project_id", projectId).not("acknowledged_at", "is", null),
    client.from("driver_notifications").select("id", { count: "exact", head: true }).eq("project_id", projectId).in("status", ["unread", "sent"]),
    client.from("route_change_instructions").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "pending"),
    client.from("driver_location_sessions").select("id,last_ping_at,status").eq("project_id", projectId).order("last_ping_at", { ascending: false }).limit(20)
  ]);

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
