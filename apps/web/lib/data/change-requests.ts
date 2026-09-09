import { cache } from "react";
import { type DataResult, runListQuery } from "@/lib/data/data-result";
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
// honest empty state; a failed read returns `ok: false` so the UI can offer a
// retry instead of showing an empty list that looks like "no change requests".
export const getChangeRequestsByProjectId = cache(async function getChangeRequestsByProjectId(
  projectId: string
): Promise<DataResult<ChangeRequestRow[]>> {
  const { client } = await resolveReadClient();
  if (!client) return { ok: true, data: [] };

  return runListQuery({
    fallback: [],
    label: "change requests",
    query: () =>
      client.from("change_requests").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(50),
    map: (rows) => rows.map(mapChangeRequest)
  });
});
