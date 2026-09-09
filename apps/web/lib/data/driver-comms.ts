import { cache } from "react";
import { getPostgresClient } from "@/lib/db/postgres";
import { rowLoose, rowObject, type Row } from "@/lib/data/row";
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

function mapInbound(row: Row): DriverInboundMessage {
  const meta = rowObject(row);
  const kind = meta.kind === "driver_message" || rowLoose(row, "issue_type") === "message" ? "message" : "issue";
  return {
    id: rowLoose(row, "id"),
    assignmentId: rowLoose(row, "assignment_id"),
    driverId: rowLoose(row, "driver_id") || null,
    issueType: rowLoose(row, "issue_type", "other"),
    severity: rowLoose(row, "severity", "warning"),
    message: rowLoose(row, "message"),
    status: rowLoose(row, "status", "open"),
    at: rowLoose(row, "created_at", new Date().toISOString()),
    kind
  };
}

function mapOutbound(row: Row): DriverOutboundMessage {
  return {
    id: rowLoose(row, "id"),
    assignmentId: rowLoose(row, "assignment_id"),
    driverId: rowLoose(row, "driver_id") || null,
    title: rowLoose(row, "title", "ข้อความจากศูนย์ควบคุม"),
    body: rowLoose(row, "body"),
    priority: rowLoose(row, "priority", "normal"),
    status: rowLoose(row, "status", "unread"),
    at: rowLoose(row, "sent_at", rowLoose(row, "created_at", new Date().toISOString()))
  };
}

// Two-way message log for a project: driver -> control (driver_issue_reports,
// including free-text messages) and control -> driver (driver_notifications).
// cache(): one render often needs this list from several components; keep it to one query per request.
export const getDriverCommsByProjectId = cache(async function getDriverCommsByProjectId(projectId: string): Promise<DriverComms> {
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
});
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
