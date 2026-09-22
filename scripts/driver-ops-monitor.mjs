#!/usr/bin/env node
// Read-only operational monitor for driver mobile/web connectivity.
//
// Usage:
//   node scripts/driver-ops-monitor.mjs
//   TOMP_MONITOR_PROJECT_ID=<uuid> TOMP_MONITOR_HOURS=12 node scripts/driver-ops-monitor.mjs

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

function envFromLocal(key) {
  try {
    const text = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
    const line = text.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

function intEnv(key, fallback) {
  const raw = process.env[key] ?? envFromLocal(key);
  if (raw == null || String(raw).trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

const dbUrl = (process.env.SUPABASE_DB_URL || envFromLocal("SUPABASE_DB_URL") || "").replace(/:6543\//, ":5432/");
if (!dbUrl) {
  console.error("SUPABASE_DB_URL is required (environment or .env.local).");
  process.exit(2);
}

const projectId = process.env.TOMP_MONITOR_PROJECT_ID || envFromLocal("TOMP_MONITOR_PROJECT_ID") || null;
const hours = intEnv("TOMP_MONITOR_HOURS", 8);
const staleSeconds = intEnv("TOMP_MONITOR_GPS_STALE_SECONDS", 600);
const staleFailLimit = intEnv("TOMP_MONITOR_MAX_STALE", 0);
const diagnosticFailLimit = intEnv("TOMP_MONITOR_MAX_DIAGNOSTICS", 0);

const sql = postgres(dbUrl, { ssl: "require", prepare: false, max: 1, onnotice: () => {} });

function ageLabel(seconds) {
  if (seconds == null) return "never";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function printTable(title, rows, columns) {
  console.log(`\n${title}`);
  if (!rows.length) {
    console.log("  none");
    return;
  }
  for (const row of rows) {
    console.log(`  - ${columns.map((column) => `${column}: ${row[column] ?? "-"}`).join(" | ")}`);
  }
}

try {
  const scopeSql = projectId ? sql`and p.id = ${projectId}` : sql``;

  const activeJobs = await sql`
    with latest_gps as (
      select distinct on (g.assignment_id)
        g.assignment_id,
        g.recorded_at,
        g.sharing_event,
        g.source,
        g.metadata,
        extract(epoch from (now() - g.recorded_at))::int as age_seconds
      from gps_locations g
      order by g.assignment_id, g.recorded_at desc
    ),
    latest_status as (
      select distinct on (s.assignment_id)
        s.assignment_id,
        s.status,
        s.created_at
      from assignment_status_updates s
      order by s.assignment_id, s.created_at desc
    )
    select
      p.project_code,
      p.project_name,
      cs.call_sign,
      coalesce(d.full_name, '-') as driver_name,
      coalesce(v.plate_number, '-') as plate_number,
      a.status as assignment_status,
      coalesce(ls.status, '-') as latest_driver_status,
      lg.recorded_at as latest_gps_at,
      lg.age_seconds,
      coalesce(lg.sharing_event, '-') as sharing_event,
      coalesce(lg.metadata->>'mode', lg.source, '-') as gps_mode
    from assignments a
    join projects p on p.id = a.project_id
    join call_signs cs on cs.id = a.call_sign_id
    left join drivers d on d.id = a.driver_id
    left join vehicles v on v.id = a.vehicle_id
    left join latest_gps lg on lg.assignment_id = a.id
    left join latest_status ls on ls.assignment_id = a.id
    where a.status in ('active', 'acknowledged', 'ready', 'published', 'planned', 'parked')
      and a.archived_at is null
      and a.deleted_at is null
      ${scopeSql}
    order by
      case when lg.age_seconds is null then 0 when lg.age_seconds > ${staleSeconds} then 1 else 2 end,
      lg.age_seconds desc nulls first,
      a.start_time asc nulls last
    limit 50
  `;

  const staleJobs = activeJobs.filter((row) => row.age_seconds == null || Number(row.age_seconds) > staleSeconds);

  const mobileSessions = await sql`
    select
      count(*)::int as total_active,
      count(*) filter (where expires_at <= now())::int as expired_but_active,
      count(*) filter (where s.metadata->>'pushToken' is null)::int as missing_push_token,
      max(last_used_at) as latest_used_at
    from driver_mobile_sessions s
    join projects p on p.id = s.project_id
    where s.status = 'active'
      ${scopeSql}
  `;

  const diagnostics = await sql`
    select
      p.project_code,
      cs.call_sign,
      g.recorded_at,
      coalesce(g.metadata->>'diagnosticReason', g.metadata->>'reason', g.metadata->>'mode', '-') as reason,
      coalesce(g.metadata->>'platform', g.source, '-') as platform
    from gps_locations g
    join projects p on p.id = g.project_id
    left join call_signs cs on cs.id = g.call_sign_id
    where g.recorded_at >= now() - (${hours}::text || ' hours')::interval
      and (
        g.metadata->>'diagnostic' = 'true'
        or g.metadata ? 'diagnosticReason'
        or g.metadata ? 'backgroundError'
        or g.metadata ? 'backgroundStatus'
      )
      ${scopeSql}
    order by g.recorded_at desc
    limit 25
  `;

  const staleLocationSessions = await sql`
    select
      p.project_code,
      cs.call_sign,
      s.status,
      s.last_ping_at,
      extract(epoch from (now() - s.last_ping_at))::int as age_seconds
    from driver_location_sessions s
    join projects p on p.id = s.project_id
    left join call_signs cs on cs.id = s.call_sign_id
    where s.status in ('healthy', 'stale')
      and (s.last_ping_at is null or s.last_ping_at < now() - (${staleSeconds}::text || ' seconds')::interval)
      ${scopeSql}
    order by s.last_ping_at asc nulls first
    limit 25
  `;

  console.log("Driver ops monitor");
  console.log(`scope: ${projectId || "all projects"} | window: ${hours}h | stale GPS: >${staleSeconds}s`);

  printTable(
    "Active / upcoming jobs",
    activeJobs.map((row) => ({
      project: row.project_code,
      callSign: row.call_sign,
      driver: row.driver_name,
      vehicle: row.plate_number,
      assignment: row.assignment_status,
      driverStatus: row.latest_driver_status,
      gpsAge: ageLabel(row.age_seconds),
      gpsMode: row.gps_mode
    })),
    ["project", "callSign", "driver", "vehicle", "assignment", "driverStatus", "gpsAge", "gpsMode"]
  );

  printTable(
    "Stale driver location sessions",
    staleLocationSessions.map((row) => ({
      project: row.project_code,
      callSign: row.call_sign,
      status: row.status,
      age: ageLabel(row.age_seconds)
    })),
    ["project", "callSign", "status", "age"]
  );

  printTable(
    "Recent diagnostic GPS rows",
    diagnostics.map((row) => ({
      project: row.project_code,
      callSign: row.call_sign,
      at: row.recorded_at?.toISOString?.() ?? row.recorded_at,
      reason: row.reason,
      platform: row.platform
    })),
    ["project", "callSign", "at", "reason", "platform"]
  );

  const sessionSummary = mobileSessions[0] ?? {};
  console.log("\nMobile sessions");
  console.log(`  active: ${sessionSummary.total_active ?? 0}`);
  console.log(`  expired but active: ${sessionSummary.expired_but_active ?? 0}`);
  console.log(`  missing push token: ${sessionSummary.missing_push_token ?? 0}`);
  console.log(`  latest used: ${sessionSummary.latest_used_at?.toISOString?.() ?? sessionSummary.latest_used_at ?? "-"}`);

  const failures = [];
  if (staleJobs.length > staleFailLimit) failures.push(`stale jobs ${staleJobs.length} > ${staleFailLimit}`);
  if (diagnostics.length > diagnosticFailLimit) failures.push(`diagnostic rows ${diagnostics.length} > ${diagnosticFailLimit}`);
  if (Number(sessionSummary.expired_but_active ?? 0) > 0) failures.push("active mobile sessions include expired rows");

  if (failures.length) {
    console.error(`\nFAILED: ${failures.join("; ")}`);
    process.exitCode = 1;
  } else {
    console.log("\nOK");
  }
} catch (error) {
  console.error("FAILED:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
