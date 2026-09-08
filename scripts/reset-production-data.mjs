#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";

const ROOT = path.resolve(new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const ASSUME_YES = argv.includes("--yes");
const PRODUCTION = argv.includes("--production");

const BUSINESS_TABLES = [
  "driver_acknowledgements",
  "driver_contact_events",
  "route_change_instructions",
  "driver_notifications",
  "driver_assignment_packets",
  "driver_location_sessions",
  "gps_locations",
  "assignment_status_updates",
  "vehicle_checkins",
  "driver_checkins",
  "driver_issue_reports",
  "driver_access_tokens",
  "change_impacts",
  "approvals",
  "change_requests",
  "publish_snapshots",
  "publish_locks",
  "assignment_versions",
  "assignments",
  "call_signs",
  "missions",
  "sessions",
  "project_days",
  "projects",
  "vehicles",
  "drivers",
  "project_members",
  "user_role_assignments",
  "profiles",
  "organizations"
];

function argValue(name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    values[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function loadEnv() {
  const file = argValue("--env") || path.join(ROOT, ".env.vercel.production.local");
  const values = { ...process.env, ...parseEnvFile(file) };
  for (const key of Object.keys(values)) {
    if (values[key] === "") delete values[key];
  }
  return { file, values };
}

function maskConnectionString(raw) {
  return raw.replace(/:\/\/([^:/@]+):[^@]*@/, "://$1:****@");
}

function normalizeConnectionString(raw) {
  return raw.replace(/:6543(\/|$|\?)/, ":5432$1");
}

async function getExistingTables(sql) {
  const rows = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name = any(${BUSINESS_TABLES})
    order by table_name
  `;
  return new Set(rows.map((row) => row.table_name));
}

async function getCounts(sql, tables) {
  const counts = {};
  for (const table of tables) {
    const rows = await sql.unsafe(`select count(*)::int as count from "public"."${table.replace(/"/g, '""')}"`);
    counts[table] = rows[0]?.count ?? 0;
  }
  return counts;
}

function printCounts(title, counts) {
  console.log(title);
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(32)} ${count}`);
  }
}

async function main() {
  if (!PRODUCTION) {
    console.error("ERROR: destructive reset requires --production.");
    process.exit(1);
  }

  if (!DRY_RUN && !ASSUME_YES) {
    console.error("ERROR: destructive reset requires --yes. Run --dry-run first to inspect counts.");
    process.exit(1);
  }

  const { file, values } = loadEnv();
  const rawUrl = values.SUPABASE_DB_URL || values.POSTGRES_URL || values.DATABASE_URL;
  if (!rawUrl) {
    console.error(`ERROR: missing SUPABASE_DB_URL in ${file}.`);
    process.exit(1);
  }

  const conn = normalizeConnectionString(rawUrl);
  console.log(`Environment : ${file}`);
  console.log(`Target      : ${maskConnectionString(conn)}`);
  console.log(`Mode        : ${DRY_RUN ? "DRY RUN" : "RESET PRODUCTION BUSINESS DATA"}`);
  console.log("");

  const sql = postgres(conn, {
    max: 1,
    idle_timeout: 10,
    connect_timeout: 20,
    ssl: "require",
    prepare: false,
    onnotice: () => {}
  });

  try {
    const existing = await getExistingTables(sql);
    const tables = BUSINESS_TABLES.filter((table) => existing.has(table));
    const before = await getCounts(sql, tables);
    printCounts("Counts before reset:", before);

    if (DRY_RUN) {
      console.log("\nDRY RUN: no rows were deleted.");
      return;
    }

    if (tables.length) {
      await sql.unsafe(`truncate table ${tables.map((table) => `"public"."${table.replace(/"/g, '""')}"`).join(", ")} restart identity cascade`);
    }

    const after = await getCounts(sql, tables);
    printCounts("\nCounts after reset:", after);
    console.log("\nReset completed. Schema, migration tracking, roles, permissions, and auth users were not truncated.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error?.message || error}`);
  if (error?.code) console.error(`pg code: ${error.code}`);
  process.exit(1);
});
