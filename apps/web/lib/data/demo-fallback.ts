import { readCleanEnv } from "@/lib/env";

// Demo data (demoKernel) is a local-development convenience for when there is no
// database at all. Once ANY backend is configured, a failed, denied, or empty
// query must surface honestly (empty list) — never as fabricated rows that look
// like real operational data. The audit (957 P0-3) flagged the silent
// substitution as a trust failure.
export function demoFallbackAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const hasSupabase = Boolean(readCleanEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"));
  const hasPostgres = Boolean(readCleanEnv("SUPABASE_DB_URL", "DATABASE_URL", "POSTGRES_URL"));
  return !hasSupabase && !hasPostgres;
}

// Pick between the demo value and an honest empty result.
export function demoOr<T>(demo: T, empty: T): T {
  return demoFallbackAllowed() ? demo : empty;
}
