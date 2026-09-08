import { rowText, type Row } from "@/lib/data/row";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

export interface VehicleEvidence {
  assignmentId: string;
  at: string;
  vehiclePhotoUrl: string | null;
  platePhotoUrl: string | null;
}

const str = (row: Row, key: string) => rowText(row, key);

// Latest vehicle check-in photo per assignment for a project, as short-lived
// signed URLs (the driver-evidence bucket is private).
export async function getVehicleEvidenceByProjectId(projectId: string): Promise<Record<string, VehicleEvidence>> {
  const { client } = getSupabaseWriteClient();
  if (!client) return {};

  const { data, error } = await client
    .from("vehicle_checkins")
    .select("assignment_id, photo_url, plate_photo_url, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data?.length) return {};

  const latest: Record<string, Row> = {};
  for (const row of data as Row[]) {
    const id = str(row, "assignment_id");
    if (!id || latest[id]) continue;
    latest[id] = row;
  }

  const paths = new Set<string>();
  for (const row of Object.values(latest)) {
    const v = str(row, "photo_url");
    const p = str(row, "plate_photo_url");
    if (v && !v.startsWith("http")) paths.add(v);
    if (p && !p.startsWith("http")) paths.add(p);
  }

  const signed = new Map<string, string>();
  if (paths.size) {
    const { data: urls } = await client.storage.from("driver-evidence").createSignedUrls(Array.from(paths), 3600);
    for (const entry of urls ?? []) {
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
    }
  }

  function resolve(value: string): string | null {
    if (!value) return null;
    if (value.startsWith("http")) return value;
    return signed.get(value) ?? null;
  }

  const result: Record<string, VehicleEvidence> = {};
  for (const [assignmentId, row] of Object.entries(latest)) {
    result[assignmentId] = {
      assignmentId,
      at: str(row, "created_at"),
      vehiclePhotoUrl: resolve(str(row, "photo_url")),
      platePhotoUrl: resolve(str(row, "plate_photo_url"))
    };
  }
  return result;
}
