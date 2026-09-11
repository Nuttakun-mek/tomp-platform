#!/usr/bin/env node
// Capacity scenario (957 P2-1). Seeds a project with the target pilot volume
// (50 vehicles, 50 drivers, 250 assignments, 10k GPS pings) into a database and
// times the hot read queries the control centre runs. Point it at a disposable
// or staging database only — it writes a lot and tags rows metadata.loadTest.
//
// Usage:
//   LOAD_TEST_DATABASE_URL=postgres://... node scripts/load-scenario.mjs
//   LOAD_TEST_DATABASE_URL=... node scripts/load-scenario.mjs --clean   # remove prior load-test rows

import process from "node:process";
import postgres from "postgres";

const url = process.env.LOAD_TEST_DATABASE_URL;
if (!url) {
  console.error("LOAD_TEST_DATABASE_URL is required (disposable / staging only).");
  process.exit(2);
}
if (/tomp-platform\.vercel|prod/i.test(url)) {
  console.error("Refusing to run against what looks like production.");
  process.exit(2);
}

const VEHICLES = 50;
const DRIVERS = 50;
const ASSIGNMENTS = 250;
const PINGS = 10_000;

const sql = postgres(url, { max: 1, onnotice: () => {} });

async function time(label, fn) {
  const t0 = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - t0);
  console.log(`  ${ms.toString().padStart(6)} ms  ${label}${typeof result === "number" ? `  (${result} rows)` : ""}`);
  return ms;
}

try {
  if (process.argv.includes("--clean")) {
    console.log("Removing prior load-test data…");
    await sql`delete from projects where metadata->>'loadTest' = 'true'`;
    console.log("Done.");
    await sql.end();
    process.exit(0);
  }

  console.log(`Seeding: ${VEHICLES} vehicles, ${DRIVERS} drivers, ${ASSIGNMENTS} assignments, ${PINGS} GPS pings…`);

  const [org] = await sql`insert into organizations (name, metadata) values ('Load Org', '{"loadTest":true}'::jsonb) returning id`;
  const [project] = await sql`
    insert into projects (organization_id, project_code, project_name, start_date, end_date, status, metadata)
    values (${org.id}, ${"LOAD-" + Date.now()}, 'Load scenario', current_date, current_date + 1, 'planning', '{"loadTest":true}'::jsonb)
    returning id`;
  const [day] = await sql`insert into project_days (project_id, operation_date, day_number) values (${project.id}, current_date, 1) returning id`;
  const [session] = await sql`insert into sessions (project_id, project_day_id, session_name, status) values (${project.id}, ${day.id}, 'main', 'draft') returning id`;
  const [mission] = await sql`insert into missions (project_id, project_day_id, session_id, mission_code, mission_name, mission_type) values (${project.id}, ${day.id}, ${session.id}, 'M-LOAD', 'load', 'shuttle') returning id`;

  const drivers = await sql`
    insert into drivers ${sql(Array.from({ length: DRIVERS }, (_, i) => ({ full_name: `Driver ${i}`, phone: `08000000${i.toString().padStart(2, "0")}`, status: "available" })))}
    returning id`;
  const vehicles = await sql`
    insert into vehicles ${sql(Array.from({ length: VEHICLES }, (_, i) => ({ plate_number: `LOAD-${i}`, vehicle_type: "van", capacity: 10, status: "available" })))}
    returning id`;
  const callSigns = await sql`
    insert into call_signs ${sql(Array.from({ length: VEHICLES }, (_, i) => ({
      project_id: project.id,
      call_sign: `A-${i}`,
      driver_id: drivers[i % DRIVERS].id,
      vehicle_id: vehicles[i].id
    })))}
    returning id`;

  const assignmentRows = Array.from({ length: ASSIGNMENTS }, (_, i) => ({
    project_id: project.id,
    mission_id: mission.id,
    call_sign_id: callSigns[i % VEHICLES].id,
    driver_id: drivers[i % DRIVERS].id,
    vehicle_id: vehicles[i % VEHICLES].id,
    // 0032 allows one active job per call sign, which is the real operating
    // rule: a vehicle does one thing at a time. The first pass round the call
    // signs is the live work; everything after it is queued behind it, which is
    // also the shape a real project has.
    status: i < VEHICLES ? "active" : "planned",
    start_time: new Date(Date.now() + (i % 24) * 3600_000).toISOString()
  }));
  const assignments = await sql`insert into assignments ${sql(assignmentRows)} returning id`;

  console.log("  inserting GPS pings…");
  for (let base = 0; base < PINGS; base += 1000) {
    const batch = Array.from({ length: Math.min(1000, PINGS - base) }, (_, k) => {
      const idx = (base + k) % assignments.length;
      return {
        project_id: project.id,
        assignment_id: assignments[idx].id,
        driver_id: drivers[idx % DRIVERS].id,
        vehicle_id: vehicles[idx % VEHICLES].id,
        latitude: 13.7 + Math.random() * 0.2,
        longitude: 100.5 + Math.random() * 0.2,
        recorded_at: new Date(Date.now() - Math.floor(Math.random() * 600_000)).toISOString(),
        source: "driver_web_app",
        sharing_event: "location_ping"
      };
    });
    await sql`insert into gps_locations ${sql(batch)}`;
  }

  console.log(`\nQuery timings for project ${project.id} (want read p95 < 600 ms):`);
  await time("assignments by project", async () => (await sql`select count(*)::int n from assignments where project_id = ${project.id}`)[0].n);
  await time("latest GPS per assignment (distinct on)", async () => (await sql`
    select count(*)::int n from (
      select distinct on (assignment_id) id from gps_locations where project_id = ${project.id} order by assignment_id, recorded_at desc
    ) x`)[0].n);
  await time("call signs by project", async () => (await sql`select count(*)::int n from call_signs where project_id = ${project.id}`)[0].n);
  await time("timeline window (50)", async () => (await sql`select count(*)::int n from (select id from timeline_events where project_id = ${project.id} order by created_at desc limit 50) x`)[0].n);
  await time("driver day list (one driver)", async () => (await sql`
    select count(*)::int n from assignments where project_id = ${project.id} and driver_id = ${drivers[0].id} and status <> 'cancelled'`)[0].n);

  const explains = [
    ["latest GPS per assignment", `select distinct on (assignment_id) id from gps_locations where project_id = '${project.id}' order by assignment_id, recorded_at desc`],
    ["timeline window (100)", `select * from timeline_events where project_id = '${project.id}' order by created_at desc limit 100`],
    ["assignment status window (200)", `select * from assignment_status_updates where project_id = '${project.id}' order by created_at desc limit 200`],
    ["driver issue reports (60)", `select * from driver_issue_reports where project_id = '${project.id}' order by created_at desc limit 60`]
  ];
  for (const [label, query] of explains) {
    console.log(`\nEXPLAIN — ${label}:`);
    const plan = await sql.unsafe(`explain (analyze, buffers, format text) ${query}`);
    for (const row of plan) console.log("  " + row["QUERY PLAN"]);
    const usesSeqScan = plan.some((row) => /Seq Scan/i.test(row["QUERY PLAN"]));
    if (usesSeqScan) console.log(`  ⚠ sequential scan — consider an index for: ${label}`);
  }

  console.log(`\nSeeded. Run with --clean to remove, or 'delete from projects where metadata->>''loadTest'' = ''true'''.`);
} catch (error) {
  console.error("FAILED:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
