#!/usr/bin/env node
// Verifies 0019 RLS scope policies using the users from seed-test-users.mjs.
//
// For each seeded user it opens a transaction, switches to the `authenticated`
// role, injects that user's JWT sub claim, and checks that SELECT visibility
// matches the intended scope. Rolls back — reads only.
//
// Usage: node scripts/verify-rls.mjs [--env <file>]   (run seed-test-users first)

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";

const ROOT = path.resolve(new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const argv = process.argv.slice(2);

function argValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}

const seedPath = path.join(ROOT, "scripts", ".seed-test-users.json");
if (!fs.existsSync(seedPath)) {
  console.error("ERROR: scripts/.seed-test-users.json missing — run node scripts/seed-test-users.mjs first.");
  process.exit(1);
}
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));

const envFile = argValue("--env") || path.join(ROOT, ".env.local");
const values = { ...process.env, ...parseEnvFile(envFile) };
const dbUrl = (values.SUPABASE_DB_URL || values.POSTGRES_URL || values.DATABASE_URL || "").replace(/:6543(\/|$|\?)/, ":5432$1");
if (!dbUrl) {
  console.error(`ERROR: ${envFile} must include SUPABASE_DB_URL.`);
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1, idle_timeout: 10, connect_timeout: 20, ssl: "require", prepare: false, onnotice: () => {} });

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}  (got ${actual}, want ${expected})`);
}

async function asUser(authUserId, fn) {
  return sql.begin(async (tx) => {
    await tx.unsafe("set local role authenticated");
    await tx.unsafe(`set local request.jwt.claims = '${JSON.stringify({ sub: authUserId, role: "authenticated" })}'`);
    const r = await fn(tx);
    await tx.unsafe("set local role postgres");
    throw { rollback: true, r };
  }).catch((e) => {
    if (e && e.rollback) return e.r;
    throw e;
  });
}

async function count(tx, table, where = "") {
  const rows = await tx.unsafe(`select count(*)::int c from public.${table} ${where}`);
  return rows[0].c;
}

async function main() {
  const { projectA, projectB } = seed;
  const u = seed.users;

  console.log("super@tomp.test — sees everything");
  await asUser(u.super.authUserId, async (tx) => {
    check("projects >= 2", (await count(tx, "projects")) >= 2, true);
    check("gps_locations readable (no error)", typeof (await count(tx, "gps_locations")) === "number", true);
    check("all profiles visible >= 4", (await count(tx, "profiles")) >= 4, true);
  });

  console.log("orgadmin@tomp.test — whole org");
  await asUser(u.orgadmin.authUserId, async (tx) => {
    check("projects >= 2 (org-wide)", (await count(tx, "projects")) >= 2, true);
    check("is_super_admin() false", (await tx.unsafe("select public.is_super_admin() s"))[0].s, false);
  });

  console.log("pm1@tomp.test — Project A only");
  await asUser(u.pm1.authUserId, async (tx) => {
    check("sees project A", (await count(tx, "projects", `where id = '${projectA}'`)), 1);
    check("does NOT see project B", (await count(tx, "projects", `where id = '${projectB}'`)), 0);
    check("total projects = 1", (await count(tx, "projects")), 1);
  });

  console.log("disp2@tomp.test — Project B only");
  await asUser(u.disp2.authUserId, async (tx) => {
    check("sees project B", (await count(tx, "projects", `where id = '${projectB}'`)), 1);
    check("does NOT see project A", (await count(tx, "projects", `where id = '${projectA}'`)), 0);
  });

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((e) => { console.error(`ERROR: ${e?.message || e}`); process.exit(1); }).finally(() => sql.end({ timeout: 5 }));
