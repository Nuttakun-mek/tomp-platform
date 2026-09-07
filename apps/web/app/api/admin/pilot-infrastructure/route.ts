import { NextResponse } from "next/server";
import { withTimeout } from "@/lib/async/timeout";
import { checkPilotInfrastructureViaPostgres } from "@/lib/db/pilot-scenario";
import { getSupabaseConnectionMessage } from "@/lib/supabase/errors";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

const requiredTables = [
  "organizations",
  "projects",
  "missions",
  "assignments",
  "driver_access_tokens",
  "driver_assignment_packets",
  "driver_notifications",
  "route_change_instructions",
  "driver_location_sessions",
  "driver_acknowledgements",
  "gps_locations",
  "timeline_events"
];

export async function GET() {
  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) {
    const postgresResult = await withTimeout(checkPilotInfrastructureViaPostgres(), 7000, "Postgres infrastructure fallback").catch((fallbackError) => ({
      mode: "postgres_direct",
      checkedAt: new Date().toISOString(),
      tables: requiredTables.map((table) => ({ table, ok: false, message: getSupabaseConnectionMessage(fallbackError) })),
      ready: false
    }));
    if (postgresResult) return NextResponse.json({ success: true, ...postgresResult });
    return NextResponse.json({ success: true, ready: false, mode, error: error || "ยังไม่ได้ตั้งค่า Supabase", tables: [] });
  }

  const tables = await Promise.all(requiredTables.map(async (table) => {
    try {
      const { error: tableError } = await withTimeout(
        Promise.resolve(client.from(table).select("*").limit(1)) as Promise<{ error: unknown }>,
        3500,
        `Supabase table ${table}`
      );
      return {
        table,
        ok: !tableError,
        message: tableError ? getSupabaseConnectionMessage(tableError) : "พร้อมใช้งาน"
      };
    } catch (tableError) {
      return {
        table,
        ok: false,
        message: getSupabaseConnectionMessage(tableError)
      };
    }
  }));

  const ready = tables.every((table) => table.ok);

  return NextResponse.json(
    {
      success: true,
      ready,
      mode,
      checkedAt: new Date().toISOString(),
      tables
    }
  );
}
