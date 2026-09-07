import { NextResponse } from "next/server";
import { withTimeout } from "@/lib/async/timeout";
import { checkPilotInfrastructureViaPostgres } from "@/lib/db/pilot-scenario";
import { PILOT_REQUIRED_TABLES } from "@/lib/db/pilot-tables";
import { getSupabaseConnectionMessage } from "@/lib/supabase/errors";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

interface TableStatus {
  table: string;
  ok: boolean;
  message: string;
}

interface InfrastructureStatus {
  mode: string;
  checkedAt: string;
  tables: TableStatus[];
  ready: boolean;
}

async function checkViaSupabase(client: NonNullable<ReturnType<typeof getSupabaseWriteClient>["client"]>, mode: string): Promise<InfrastructureStatus> {
  const tables = await Promise.all(
    PILOT_REQUIRED_TABLES.map(async (table) => {
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
        return { table, ok: false, message: getSupabaseConnectionMessage(tableError) };
      }
    })
  );

  return { mode, checkedAt: new Date().toISOString(), tables, ready: tables.every((table) => table.ok) };
}

export async function GET() {
  const { client, error, mode } = getSupabaseWriteClient();

  let status: InfrastructureStatus;

  if (client) {
    status = await checkViaSupabase(client, mode);
  } else {
    const postgresResult = await withTimeout(checkPilotInfrastructureViaPostgres(), 7000, "Postgres infrastructure fallback").catch(
      (fallbackError): InfrastructureStatus => ({
        mode: "postgres_direct",
        checkedAt: new Date().toISOString(),
        tables: PILOT_REQUIRED_TABLES.map((table) => ({ table, ok: false, message: getSupabaseConnectionMessage(fallbackError) })),
        ready: false
      })
    );

    status =
      postgresResult ?? ({
        mode,
        checkedAt: new Date().toISOString(),
        tables: PILOT_REQUIRED_TABLES.map((table) => ({ table, ok: false, message: error || "ยังไม่ได้ตั้งค่า Supabase" })),
        ready: false
      } satisfies InfrastructureStatus);
  }

  // Always HTTP 200 (the route itself ran); callers must inspect `ready`.
  // A 503 here would break generic "does the route respond" smoke checks.
  return NextResponse.json({ success: true, ...status, ...(status.ready ? {} : { error: error || undefined }) });
}
