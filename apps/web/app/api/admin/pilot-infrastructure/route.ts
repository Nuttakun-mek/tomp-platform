import { NextResponse } from "next/server";
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
    return NextResponse.json({ success: false, ready: false, mode, error: error || "ยังไม่ได้ตั้งค่า Supabase" }, { status: 503 });
  }

  const tables = [];
  for (const table of requiredTables) {
    try {
      const { error: tableError } = await client.from(table).select("*").limit(1);
      tables.push({
        table,
        ok: !tableError,
        message: tableError ? getSupabaseConnectionMessage(tableError) : "พร้อมใช้งาน"
      });
    } catch (tableError) {
      tables.push({
        table,
        ok: false,
        message: getSupabaseConnectionMessage(tableError)
      });
    }
  }

  const ready = tables.every((table) => table.ok);
  return NextResponse.json(
    {
      success: ready,
      ready,
      mode,
      checkedAt: new Date().toISOString(),
      tables
    },
    { status: ready ? 200 : 503 }
  );
}
