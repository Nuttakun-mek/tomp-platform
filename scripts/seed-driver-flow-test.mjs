#!/usr/bin/env node
// Seed one complete driver job (project -> day -> mission -> call sign -> driver
// -> vehicle -> assignment -> QR token + PIN) so the QR -> session -> GPS flow
// can be exercised end to end, then remove it again.
//
// Everything is tagged `metadata.smokeTest = true`, which is what
// public.purge_smoke_test_data() keys on, so --purge cleans up every row this
// created (the project delete cascades to days/missions/call signs/assignments/
// tokens/gps rows/mobile sessions).
//
// Usage:
//   node scripts/seed-driver-flow-test.mjs --seed     # create, print QR URL + PIN
//   node scripts/seed-driver-flow-test.mjs --status   # what smoke data exists
//   node scripts/seed-driver-flow-test.mjs --purge    # remove it all
//
// Connection: SUPABASE_DB_URL from the environment or .env.local.
// The token hash uses DRIVER_ACCESS_TOKEN_SECRET — it must match the deployment
// you intend to open the QR against, or the driver page will not find the job.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const args = new Set(process.argv.slice(2));

function envFromLocal(key) {
  try {
    const text = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
    const line = text.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

const dbUrl = (process.env.SUPABASE_DB_URL || envFromLocal("SUPABASE_DB_URL") || "").replace(/:6543\//, ":5432/");
const tokenSecret = process.env.DRIVER_ACCESS_TOKEN_SECRET || envFromLocal("DRIVER_ACCESS_TOKEN_SECRET") || "development-driver-token-secret";
const baseUrl = (process.env.TOMP_BASE_URL || "https://tomp-platform.vercel.app").replace(/\/$/, "");

if (!dbUrl) {
  console.error("SUPABASE_DB_URL is required (environment or .env.local).");
  process.exit(2);
}

// Mirrors apps/web/lib/driver-access/token.ts
const hashToken = (token) => crypto.createHash("sha256").update(`${tokenSecret}:${token}`).digest("hex");
const hashPin = (pin) => crypto.createHash("sha256").update(`pin:${tokenSecret}:${pin.trim()}`).digest("hex");
const makePin = () => String(100000 + (crypto.randomBytes(4).readUInt32BE(0) % 900000));

const sql = postgres(dbUrl, { ssl: "require", prepare: false, max: 1, onnotice: () => {} });
const SMOKE = sql.json({ smokeTest: true, source: "seed-driver-flow-test" });

async function status() {
  const [{ c: projects }] = await sql`select count(*)::int c from projects where metadata->>'smokeTest' = 'true'`;
  const [{ c: drivers }] = await sql`select count(*)::int c from drivers where metadata->>'smokeTest' = 'true'`;
  const [{ c: vehicles }] = await sql`select count(*)::int c from vehicles where metadata->>'smokeTest' = 'true'`;
  const [{ c: tokens }] = await sql`
    select count(*)::int c from driver_access_tokens t
    join projects p on p.id = t.project_id where p.metadata->>'smokeTest' = 'true'`;
  const [{ c: pings }] = await sql`
    select count(*)::int c from gps_locations g
    join projects p on p.id = g.project_id where p.metadata->>'smokeTest' = 'true'`;
  const [{ c: sessions }] = await sql`
    select count(*)::int c from driver_mobile_sessions s
    join projects p on p.id = s.project_id where p.metadata->>'smokeTest' = 'true'`;
  console.log(`smoke data — projects ${projects} · drivers ${drivers} · vehicles ${vehicles} · qr tokens ${tokens} · gps pings ${pings} · mobile sessions ${sessions}`);
}

async function seed() {
  return sql.begin(async (sql) => seedIn(sql));
}

async function seedIn(sql) {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  const [{ id: orgId }] = await sql`select id from organizations order by created_at asc limit 1`;

  const [project] = await sql`
    insert into projects (organization_id, project_code, project_name, start_date, end_date, timezone, status, metadata)
    values (${orgId}, ${`SMOKE-${stamp}-${suffix}`}, 'Driver flow smoke test', current_date, current_date + 1, 'Asia/Bangkok', 'planning', ${SMOKE})
    returning id, project_code`;

  const [day] = await sql`
    insert into project_days (project_id, operation_date, day_number, timezone, status, metadata)
    values (${project.id}, current_date, 1, 'Asia/Bangkok', 'draft', ${SMOKE})
    returning id`;

  const [mission] = await sql`
    insert into missions (project_id, project_day_id, mission_code, mission_name, mission_type, priority, status, planned_start_time, metadata)
    values (${project.id}, ${day.id}, ${`M-${suffix}`}, 'รับส่งผู้ร่วมงาน (smoke)', 'transfer', 'normal', 'draft', now(), ${SMOKE})
    returning id`;

  const [callSign] = await sql`
    insert into call_signs (project_id, call_sign, group_name, status, metadata)
    values (${project.id}, ${`CS-${suffix}`}, 'smoke', 'active', ${SMOKE})
    returning id, call_sign`;

  const [driver] = await sql`
    insert into drivers (organization_id, full_name, phone, license_type, status, metadata)
    values (${orgId}, ${`คนขับทดสอบ ${suffix}`}, '0800000000', 'personal', 'available', ${SMOKE})
    returning id, full_name`;

  const [vehicle] = await sql`
    insert into vehicles (organization_id, plate_number, vehicle_type, capacity, status, metadata)
    values (${orgId}, ${`ทส-${suffix}`}, 'sedan', 4, 'available', ${SMOKE})
    returning id, plate_number`;

  const [assignment] = await sql`
    insert into assignments (project_id, mission_id, call_sign_id, vehicle_id, driver_id, status, start_time, end_time, metadata)
    values (${project.id}, ${mission.id}, ${callSign.id}, ${vehicle.id}, ${driver.id}, 'published', now(), now() + interval '4 hours',
      ${sql.json({ smokeTest: true, pickupLocation: "โรงแรมทดสอบ", dropoffLocation: "ศูนย์ประชุมทดสอบ", commitmentTime: "09:00" })})
    returning id`;

  const token = `tomp_${assignment.id}_${driver.id}_${crypto.randomBytes(32).toString("base64url")}`;
  const pin = makePin();

  await sql`
    insert into driver_access_tokens (project_id, assignment_id, driver_id, token_hash, access_scope, status, expires_at, metadata)
    values (${project.id}, ${assignment.id}, ${driver.id}, ${hashToken(token)}, 'assignment', 'active', now() + interval '24 hours',
      ${sql.json({ smokeTest: true, pinHash: hashPin(pin) })})`;

  console.log("\nSeeded a driver job tagged smokeTest=true.\n");
  console.log(`  project      ${project.project_code}  (${project.id})`);
  console.log(`  call sign    ${callSign.call_sign}`);
  console.log(`  driver       ${driver.full_name}`);
  console.log(`  vehicle      ${vehicle.plate_number}`);
  console.log(`  assignment   ${assignment.id}`);
  console.log(`\n  QR URL   ${baseUrl}/driver/${token}`);
  console.log(`  PIN      ${pin}\n`);
  console.log("  Token hashed with DRIVER_ACCESS_TOKEN_SECRET from this machine — the");
  console.log("  target deployment must use the same secret or the page shows no job.\n");
  console.log("  Clean up with: node scripts/seed-driver-flow-test.mjs --purge\n");
}

// Evidence photos live in Supabase storage under
// <projectId>/<assignmentId>/<kind>-<ts>.<ext> (see lib/storage/photo-upload.ts),
// which purge_smoke_test_data() — SQL only — cannot reach. Remove them before
// the rows go, while the project ids are still resolvable.
async function purgeEvidencePhotos() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || envFromLocal("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envFromLocal("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return 0;

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "content-type": "application/json" };
  const list = async (prefix) => {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/list/driver-evidence`, {
      method: "POST",
      headers,
      body: JSON.stringify({ prefix, limit: 1000 })
    }).catch(() => null);
    const json = res && res.ok ? await res.json().catch(() => []) : [];
    return Array.isArray(json) ? json : [];
  };

  const projects = await sql`select id from projects where metadata->>'smokeTest' = 'true'`;
  const paths = [];
  for (const { id } of projects) {
    for (const assignment of await list(id)) {
      for (const file of await list(`${id}/${assignment.name}`)) {
        paths.push(`${id}/${assignment.name}/${file.name}`);
      }
    }
  }
  if (!paths.length) return 0;

  const res = await fetch(`${supabaseUrl}/storage/v1/object/driver-evidence`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ prefixes: paths })
  }).catch(() => null);
  return res && res.ok ? paths.length : 0;
}

async function purge() {
  const photos = await purgeEvidencePhotos().catch(() => 0);
  const [row] = await sql`select public.purge_smoke_test_data() as result`;
  console.log(`evidence photos removed -> ${photos}`);
  console.log("purge_smoke_test_data() ->", JSON.stringify(row.result));
}

try {
  if (args.has("--purge")) await purge();
  else if (args.has("--status")) await status();
  else if (args.has("--seed")) {
    await seed();
    await status();
  } else {
    console.log("Usage: node scripts/seed-driver-flow-test.mjs [--seed | --status | --purge]");
  }
} catch (error) {
  console.error("FAILED:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
