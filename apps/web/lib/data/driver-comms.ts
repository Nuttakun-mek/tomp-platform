import { getPostgresClient } from "@/lib/db/postgres";
import { resolveReadClient } from "@/lib/supabase/scoped-client";

export interface DriverInboundMessage {
  id: string;
  assignmentId: string;
  driverId: string | null;
  issueType: string;
  severity: string;
  message: string;
  status: string;
  at: string;
  kind: "message" | "issue";
}

export interface DriverOutboundMessage {
  id: string;
  assignmentId: string;
  driverId: string | null;
  title: string;
  body: string;
  priority: string;
  status: string;
  at: string;
}

export interface DriverComms {
  inbound: DriverInboundMessage[];
  outbound: DriverOutboundMessage[];
}

type Row = Record<string, unknown>;

function str(row: Row, key: string, fallback = ""): string {
  const value = row[key];
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function metaObject(row: Row): Record<string, unknown> {
  const value = row.metadata;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function mapInbound(row: Row): DriverInboundMessage {
  const meta = metaObject(row);
  const kind = meta.kind === "driver_message" || str(row, "issue_type") === "message" ? "message" : "issue";
  return {
    id: str(row, "id"),
    assignmentId: str(row, "assignment_id"),
    driverId: str(row, "driver_id") || null,
    issueType: str(row, "issue_type", "other"),
    severity: str(row, "severity", "warning"),
    message: str(row, "message"),
    status: str(row, "status", "open"),
    at: str(row, "created_at", new Date().toISOString()),
    kind
  };
}

function mapOutbound(row: Row): DriverOutboundMessage {
  return {
    id: str(row, "id"),
    assignmentId: str(row, "assignment_id"),
    driverId: str(row, "driver_id") || null,
    title: str(row, "title", "ข้อความจากศูนย์ควบคุม"),
    body: str(row, "body"),
    priority: str(row, "priority", "normal"),
    status: str(row, "status", "unread"),
    at: str(row, "sent_at", str(row, "created_at", new Date().toISOString()))
  };
}

// Two-way message log for a project: driver -> control (driver_issue_reports,
// including free-text messages) and control -> driver (driver_notifications).
export async function getDriverCommsByProjectId(projectId: string): Promise<DriverComms> {
  const { client } = await resolveReadClient();
  if (client) {
    const [inbound, outbound] = await Promise.all([
      client.from("driver_issue_reports").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(60),
      client.from("driver_notifications").select("*").eq("project_id", projectId).order("sent_at", { ascending: false }).limit(60)
    ]);
    if (!inbound.error && !outbound.error) {
      return {
        inbound: ((inbound.data as Row[] | null) ?? []).map(mapInbound),
        outbound: ((outbound.data as Row[] | null) ?? []).map(mapOutbound)
      };
    }
  }
  return getDriverCommsByProjectIdViaPostgres(projectId);
}

async function getDriverCommsByProjectIdViaPostgres(projectId: string): Promise<DriverComms> {
  const sql = getPostgresClient();
  if (!sql) return { inbound: [], outbound: [] };
  try {
    const [inbound, outbound] = await Promise.all([
      sql<Row[]>`select * from driver_issue_reports where project_id = ${projectId} order by created_at desc limit 60`,
      sql<Row[]>`select * from driver_notifications where project_id = ${projectId} order by sent_at desc nulls last limit 60`
    ]);
    return { inbound: inbound.map(mapInbound), outbound: outbound.map(mapOutbound) };
  } catch {
    return { inbound: [], outbound: [] };
  }
}
