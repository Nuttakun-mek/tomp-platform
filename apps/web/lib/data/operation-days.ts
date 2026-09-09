import { cache } from "react";
import type { OperationDay, OperationDayStatus } from "@tomp/types/domain";
import { withTimeout } from "@/lib/async/timeout";
import { resolveReadClient } from "@/lib/supabase/scoped-client";

type Row = Record<string, unknown>;

function str(row: Row, key: string, fallback = "") {
  const value = row[key];
  return typeof value === "string" && value ? value : fallback;
}

function mapOperationDay(row: Row): OperationDay {
  const created = str(row, "created_at", new Date().toISOString());
  return {
    id: str(row, "id"),
    projectId: str(row, "project_id"),
    operationDate: str(row, "operation_date"),
    dayNumber: typeof row.day_number === "number" ? row.day_number : Number(row.day_number) || 1,
    timezone: str(row, "timezone") || null,
    status: (str(row, "status", "draft") as OperationDayStatus),
    briefingNotes: str(row, "briefing_notes") || null,
    closingNotes: str(row, "closing_notes") || null,
    createdAt: created,
    updatedAt: str(row, "updated_at", created),
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? (row.metadata as Record<string, unknown>) : {}
  };
}

// Real operation days for a project. Publish readiness must never mix these with
// demo data — a real project with no days should show that blocker honestly.
export const getOperationDaysByProjectId = cache(async function getOperationDaysByProjectId(projectId: string): Promise<OperationDay[]> {
  const { client } = await resolveReadClient();
  if (!client) return [];

  try {
    const { data, error } = await withTimeout(
      client.from("project_days").select("*").eq("project_id", projectId).order("day_number", { ascending: true }),
      2200,
      "operation days"
    );
    if (error || !Array.isArray(data)) return [];
    return data.map(mapOperationDay);
  } catch {
    return [];
  }
});
