import "server-only";

import postgres, { type Sql } from "postgres";
import { readCleanEnv } from "@/lib/env";

let sqlClient: Sql | null | undefined;

export function getPostgresClient() {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return null;
  }

  if (readCleanEnv("TOMP_ENABLE_POSTGRES_FALLBACK") !== "1") {
    return null;
  }

  if (sqlClient !== undefined) return sqlClient;

  const databaseUrl = readCleanEnv("SUPABASE_DB_URL", "DATABASE_URL", "POSTGRES_URL");
  if (!databaseUrl) {
    sqlClient = null;
    return null;
  }

  sqlClient = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 5,
    ssl: "require",
    prepare: false
  });

  return sqlClient;
}

export function hasPostgresClient() {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return false;
  }

  return readCleanEnv("TOMP_ENABLE_POSTGRES_FALLBACK") === "1" && Boolean(readCleanEnv("SUPABASE_DB_URL", "DATABASE_URL", "POSTGRES_URL"));
}
