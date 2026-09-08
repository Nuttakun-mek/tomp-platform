import "server-only";

import { getSupabaseServerDataClient } from "@/lib/supabase/server";

// Tables where the smoke-test / live-test tools write rows tagged
// metadata.smokeTest = true. Ordered so FK dependents go before their parents;
// most children (missions/assignments/gps_locations/tokens/...) are removed by
// ON DELETE CASCADE when their project row is deleted.
const TAGGED_TABLES = ["projects", "drivers", "vehicles", "profiles", "organizations"] as const;

export type PurgeCounts = Record<string, number>;

export async function countSmokeTestRows(): Promise<PurgeCounts> {
  const client = getSupabaseServerDataClient();
  if (!client) return {};
  const counts: PurgeCounts = {};
  for (const table of TAGGED_TABLES) {
    const { count } = await client.from(table).select("id", { count: "exact", head: true }).eq("metadata->>smokeTest", "true");
    counts[table] = count ?? 0;
  }
  return counts;
}

export async function purgeSmokeTestRows(): Promise<{ ok: true; deleted: PurgeCounts } | { ok: false; error: string }> {
  const client = getSupabaseServerDataClient();
  if (!client) return { ok: false, error: "ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล" };

  const deleted: PurgeCounts = {};
  for (const table of TAGGED_TABLES) {
    const { data, error } = await client
      .from(table)
      .delete()
      .eq("metadata->>smokeTest", "true")
      .select("id");
    if (error) return { ok: false, error: `ลบจากตาราง ${table} ไม่สำเร็จ: ${error.message}` };
    deleted[table] = data?.length ?? 0;
  }
  return { ok: true, deleted };
}
