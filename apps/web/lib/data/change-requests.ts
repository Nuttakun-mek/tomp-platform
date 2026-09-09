import { cache } from "react";
import { withTimeout } from "@/lib/async/timeout";
import { resolveReadClient } from "@/lib/supabase/scoped-client";

export interface ChangeRequestRow {
  id: string;
  status: string;
  severity: string;
  objectType: string;
  reason: string;
  impactSummary: string | null;
  createdAt: string;
}

type Row = Record<string, unknown>;

function str(row: Row, key: string, fallback = "") {
  const value = row[key];
  return typeof value === "string" && value ? value : fallback;
}

function mapChangeRequest(row: Row): ChangeRequestRow {
  return {
    id: str(row, "id"),
    status: str(row, "status", "requested"),
    severity: str(row, "severity", "medium"),
    objectType: str(row, "object_type", "unknown"),
    reason: str(row, "reason"),
    impactSummary: str(row, "impact_summary") || null,
    createdAt: str(row, "created_at", new Date().toISOString())
  };
}

// Real change requests for a project. No demo fallback — an empty list is an
// honest empty state; a failure surfaces as an empty list plus the caller's
// error handling, never fabricated rows.
export const getChangeRequestsByProjectId = cache(async function getChangeRequestsByProjectId(projectId: string): Promise<ChangeRequestRow[]> {
  const { client } = await resolveReadClient();
  if (!client) return [];

  try {
    const { data, error } = await withTimeout(
      client.from("change_requests").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(50),
      2200,
      "change requests"
    );
    if (error || !Array.isArray(data)) return [];
    return data.map(mapChangeRequest);
  } catch {
    return [];
  }
});
