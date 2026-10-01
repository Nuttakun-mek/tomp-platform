#!/usr/bin/env node
// Read-only. Compares GPS presets on real shifts: pings per hour by mode,
// accuracy, the gaps between pings, and how often a phone went quiet.
//
//   node scripts/gps-preset-report.mjs            # last 7 days
//   node scripts/gps-preset-report.mjs --days 14
//
// Pings carry metadata.gpsPreset (apps/mobile-driver/src/services/gps-presets.ts).
// Pings from before presets existed have none and are counted as "baseline" —
// the settings that shipped in 1.0.0 (12). Battery level is not on the pings
// yet (needs a native build); until then, pings per hour is the proxy for the
// radio work a preset costs. See docs/11-codex/991.

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
const daysFlag = args.indexOf("--days");
const days = daysFlag === -1 ? 7 : Number(args[daysFlag + 1]) || 7;
const url = env("SUPABASE_DB_URL");
if (!url) {
  console.error("SUPABASE_DB_URL is not in .env.local");
  process.exit(2);
}
const sql = postgres(url.replace(/:6543\//, ":5432/"), { ssl: "require", prepare: false, max: 1, onnotice() {} });

try {
  // Per preset and mode: pings, the hours they cover, pings per covered hour.
  const byPreset = await sql`
    with pings as (
      select coalesce(metadata->>'gpsPreset', 'baseline') as preset,
             coalesce(metadata->>'mode', 'other') as mode,
             coalesce(driver_id::text, assignment_id::text) as device,
             recorded_at, accuracy,
             date_trunc('hour', recorded_at) as hour
      from gps_locations
      where recorded_at > now() - make_interval(days => ${days})
        and metadata->>'platform' = 'mobile_driver'
    )
    select preset, mode,
           count(*) as pings,
           count(distinct (device, hour)) as device_hours,
           round(count(*)::numeric / nullif(count(distinct (device, hour)), 0), 1) as pings_per_device_hour,
           round(avg(accuracy)::numeric, 0) as avg_accuracy_m,
           round((percentile_cont(0.9) within group (order by accuracy))::numeric, 0) as p90_accuracy_m
    from pings group by preset, mode order by preset, mode`;
  console.log(`\nGPS presets, last ${days} days (mobile app pings only)`);
  console.table(byPreset);

  // Gaps between consecutive pings of one device while sharing: the price of
  // saving battery is never allowed to be a vehicle missing from the map.
  const gaps = await sql`
    with ordered as (
      select coalesce(metadata->>'gpsPreset', 'baseline') as preset,
             coalesce(driver_id::text, assignment_id::text) as device,
             recorded_at,
             extract(epoch from recorded_at - lag(recorded_at) over (partition by coalesce(driver_id::text, assignment_id::text) order by recorded_at)) as gap_s,
             sharing_event
      from gps_locations
      where recorded_at > now() - make_interval(days => ${days})
        and metadata->>'platform' = 'mobile_driver'
    )
    select preset,
           count(*) filter (where gap_s is not null) as intervals,
           round((percentile_cont(0.5) within group (order by gap_s))::numeric, 0) as median_gap_s,
           round((percentile_cont(0.9) within group (order by gap_s))::numeric, 0) as p90_gap_s,
           count(*) filter (where gap_s > 300 and gap_s < 3600 and coalesce(sharing_event, '') <> 'sharing_started') as quiet_5_to_60_min
    from ordered group by preset order by preset`;
  console.log("\nGaps between pings (a long gap while sharing = vehicle missing from the map)");
  console.table(gaps);
} finally {
  await sql.end();
}
