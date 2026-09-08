import { resolveReadClient } from "@/lib/supabase/scoped-client";

export interface AssignmentStatusUpdate {
  status: string;
  source: string;
  at: string;
}

// Latest driver-reported status per assignment, straight from
// assignment_status_updates (mission control was only inferring status from GPS
// ping metadata before, so a status change without a ping never showed up).
export async function getLatestAssignmentStatuses(projectId: string): Promise<Record<string, AssignmentStatusUpdate>> {
  const { client } = await resolveReadClient();
  if (!client) return {};

  const { data, error } = await client
    .from("assignment_status_updates")
    .select("assignment_id, status, source, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data?.length) return {};

  const latest: Record<string, AssignmentStatusUpdate> = {};
  for (const row of data as Array<Record<string, unknown>>) {
    const id = String(row.assignment_id ?? "");
    if (!id || latest[id]) continue;
    latest[id] = {
      status: String(row.status ?? "unknown"),
      source: String(row.source ?? "driver_qr"),
      at: String(row.created_at ?? "")
    };
  }
  return latest;
}
