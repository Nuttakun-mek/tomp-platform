#!/usr/bin/env node
// What the control room was actually told, per unit: the gap between pings, the
// accuracy of each fix, and whether the device claimed to be standing still.
//
// Every GPS bug found on 2026-09-11 was found with this and none of them were
// visible from the code:
//
//   - a parked driver turning red, because Android defers background work once
//     the device stops moving (gaps of 175s then 401s against a 180s limit)
//   - a vehicle driving across town reported as parked, because Accuracy.Balanced
//     returns the cell tower's position and a tower does not move — the same
//     coordinates repeated for twenty minutes at 100m accuracy, then the marker
//     jumped 1.2km when a real fix landed
//
// Both looked like application bugs and neither was. Run this before theorising.
//
// Usage:
//   node scripts/inspect-pings.mjs                     # every unit active in the last 3h
//   node scripts/inspect-pings.mjs "ดอกไม้ แจกัน ริมธาร"  # one unit, ping by ping
//   node scripts/inspect-pings.mjs --hours 12
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

function env(key) {
  const text = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const line = text.split(/\r?\n/).find((row) => row.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "") : null;
}

const args = process.argv.slice(2);
const hoursFlag = args.indexOf("--hours");
const hours = hoursFlag === -1 ? 3 : Number(args[hoursFlag + 1]) || 3;
const callSign = args.find((a) => !a.startsWith("--") && a !== String(hours)) ?? null;

const url = env("SUPABASE_DB_URL");
if (!url) {
  console.error("SUPABASE_DB_URL is not in .env.local");
  process.exit(2);
}
// The transaction pooler cannot hold a session; 5432 can.
const sql = postgres(url.replace(/:6543\//, ":5432/"), { ssl: "require", prepare: false, max: 1, onnotice() {} });

const FRESH_LIMIT = 180; // cadence 120s + 60s slack, the usual case
const SLOW_LIMIT = 600; // plus the slow-signal grace

function band(ageSeconds) {
  if (ageSeconds <= FRESH_LIMIT) return "สด/จอดอยู่";
  if (ageSeconds <= SLOW_LIMIT) return "สัญญาณช้า";
  return "ขาดการอัปเดต";
}

try {
  if (callSign) {
    const rows = await sql`
      select g.recorded_at, g.latitude, g.longitude, g.accuracy, g.sharing_event,
             g.metadata->>'platform' as platform, g.metadata->>'mode' as mode,
             g.metadata->>'heartbeatMs' as heartbeat_ms, g.metadata->>'idle' as idle,
             g.metadata->>'diagnosticReason' as diagnostic_reason,
             g.metadata->>'diagnosticMessage' as diagnostic_message
      from gps_locations g
      join call_signs c on c.id = g.call_sign_id
      where c.call_sign = ${callSign}
        and g.recorded_at > now() - (${`${hours} hours`}::interval)
      order by g.recorded_at`;

    console.log(`${callSign} — ${rows.length} pings in the last ${hours}h\n`);
    let previous = null;
    for (const row of rows) {
      const at = new Date(row.recorded_at);
      const gap = previous ? Math.round((at - previous) / 1000) : 0;
      const accuracy = row.accuracy === null ? "  -" : `${Math.round(Number(row.accuracy))}`.padStart(3);
      // A fix vaguer than the 30m movement threshold cannot prove the vehicle
      // stayed put, which is what made a moving vehicle read as parked.
      const coarse = row.accuracy !== null && Number(row.accuracy) > 30 ? " ← too coarse to judge movement" : "";
      const diagnostic = row.diagnostic_reason ? `  diagnostic=${row.diagnostic_reason}${row.diagnostic_message ? ` (${row.diagnostic_message})` : ""}` : "";
      console.log(
        `${at.toISOString().slice(11, 19)}  +${String(gap).padStart(4)}s  ` +
          `${Number(row.latitude).toFixed(6)},${Number(row.longitude).toFixed(6)}  ` +
          `acc=${accuracy}m  ${row.mode ?? "-"}${row.idle === "true" ? " idle" : ""}  ${row.sharing_event}${coarse}${diagnostic}`
      );
      previous = at;
    }
    if (rows.length) {
      const gaps = rows.slice(1).map((r, i) => Math.round((new Date(r.recorded_at) - new Date(rows[i].recorded_at)) / 1000));
      const age = Math.round((Date.now() - new Date(rows[rows.length - 1].recorded_at)) / 1000);
      console.log(`\nlargest gap: ${Math.max(...gaps, 0)}s | over ${FRESH_LIMIT}s: ${gaps.filter((g) => g > FRESH_LIMIT).length}`);
      console.log(`newest ping is ${age}s old — the board shows: ${band(age)}`);
    }
  } else {
    const rows = await sql`
      select distinct on (g.call_sign_id)
        c.call_sign, g.recorded_at, g.latitude, g.longitude, g.accuracy,
        g.metadata->>'mode' as mode, g.metadata->>'idle' as idle,
        g.metadata->>'diagnosticReason' as diagnostic_reason
      from gps_locations g
      join call_signs c on c.id = g.call_sign_id
      where g.recorded_at > now() - (${`${hours} hours`}::interval)
      order by g.call_sign_id, g.recorded_at desc`;

    console.log(`units seen in the last ${hours}h: ${rows.length}\n`);
    for (const row of rows) {
      const age = Math.round((Date.now() - new Date(row.recorded_at)) / 1000);
      console.log(`${String(row.call_sign).padEnd(24)} ${String(age).padStart(5)}s ago   ${band(age)}`);
      console.log(
        `  ${Number(row.latitude).toFixed(6)},${Number(row.longitude).toFixed(6)}  ` +
          `acc=${row.accuracy === null ? "-" : Math.round(Number(row.accuracy))}m  ${row.mode ?? "-"}${row.idle === "true" ? " idle" : ""}${row.diagnostic_reason ? `  diagnostic=${row.diagnostic_reason}` : ""}`
      );
    }
    console.log(`\nOne unit, ping by ping:  node scripts/inspect-pings.mjs "<call sign>"`);
  }
} finally {
  await sql.end();
}
