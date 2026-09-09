#!/usr/bin/env node
// 957 P1-2 — checksum drift analysis.
//
// Migrations 0011 / 0018 / 0019 / 0020 were edited in the repo AFTER being
// applied to production, so their recorded checksum no longer matches the file.
// The question this answers: does the LIVE schema still match what the current
// repo history produces, or did production miss a real change?
//
// It applies database/migrations/*.sql to a disposable database (the "expected"
// schema) and compares the RBAC-relevant objects against production (read only):
//   - RLS policies (name / cmd / USING / WITH CHECK) on every public table
//   - the SECURITY DEFINER helper functions (pg_get_functiondef)
//   - role_permissions rows (role_key -> permission_key)
//
// Usage:
//   SCHEMA_TEST_DATABASE_URL=postgres://postgres:pw@localhost:55490/postgres \
//   PROD_DATABASE_URL=postgres://...pooler... \
//   node scripts/check-migration-drift.mjs
//
// PROD_DATABASE_URL defaults to SUPABASE_DB_URL from .env.local. Read only —
// it runs SELECTs against pg_catalog only.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const MIGRATIONS_DIR = path.join(ROOT, "database", "migrations");

function readEnvLocal(key) {
  try {
    const text = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
    const line = text.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

const testUrl = process.env.SCHEMA_TEST_DATABASE_URL;
const prodUrl = process.env.PROD_DATABASE_URL || readEnvLocal("SUPABASE_DB_URL");
if (!testUrl || /prod|staging/i.test(testUrl)) {
  console.error("SCHEMA_TEST_DATABASE_URL is required and must be a disposable DB.");
  process.exit(2);
}
if (!prodUrl) {
  console.error("PROD_DATABASE_URL / SUPABASE_DB_URL not found.");
  process.exit(2);
}

// Supabase pooler on 6543 can't do session-level work reliably; use 5432.
const prodConn = prodUrl.replace(/:6543\//, ":5432/");

const STUB = `
  create extension if not exists pgcrypto;
  drop schema if exists auth cascade; create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
  create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create or replace function auth.role() returns text language sql stable as $$ select 'authenticated'::text $$;
  drop schema if exists storage cascade; create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, created_at timestamptz default now(), metadata jsonb);
  create or replace function storage.foldername(name text) returns text[] language sql stable as $$ select string_to_array(name, '/') $$;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  end $$;
  do $$ begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then create publication supabase_realtime; end if;
  end $$;
`;

const POLICY_SQL = `
  select schemaname||'.'||tablename as tbl, policyname, cmd,
         coalesce(qual,'') as qual, coalesce(with_check,'') as with_check
  from pg_policies where schemaname = 'public'
  order by tbl, policyname
`;

const FUNC_SQL = `
  select p.proname,
         pg_get_functiondef(p.oid) as def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'is_super_admin','is_project_member','can_read_project','is_org_admin',
      'current_org_id','is_project_member_of','has_permission','current_profile_id',
      'is_org_member','user_has_role'
    )
  order by p.proname
`;

const ROLEPERM_SQL = `
  select r.role_key, pm.permission_key
  from public.role_permissions rp
  join public.roles r on r.id = rp.role_id
  join public.permissions pm on pm.id = rp.permission_id
  order by r.role_key, pm.permission_key
`;

function norm(sql) {
  return sql.replace(/\s+/g, " ").replace(/\s*([(),])\s*/g, "$1").trim().toLowerCase();
}

async function snapshotExpected() {
  const sql = postgres(testUrl, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe("drop schema if exists public cascade; create schema public; grant all on schema public to public;");
    await sql.unsafe(STUB);
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      await sql.unsafe(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    }
    return await collect(sql);
  } finally {
    await sql.end();
  }
}

async function snapshotProd() {
  const sql = postgres(prodConn, { max: 1, ssl: "require", prepare: false, onnotice: () => {} });
  try {
    return await collect(sql);
  } finally {
    await sql.end();
  }
}

async function collect(sql) {
  const policies = await sql.unsafe(POLICY_SQL);
  const funcs = await sql.unsafe(FUNC_SQL);
  const roleperms = await sql.unsafe(ROLEPERM_SQL);
  return {
    policies: policies.map((p) => `${p.tbl} :: ${p.policyname} [${p.cmd}] USING(${norm(p.qual)}) CHECK(${norm(p.with_check)})`),
    funcs: new Map(funcs.map((f) => [f.proname, norm(f.def)])),
    roleperms: roleperms.map((r) => `${r.role_key} -> ${r.permission_key}`)
  };
}

function diffList(label, expected, actual) {
  const e = new Set(expected);
  const a = new Set(actual);
  const missing = [...e].filter((x) => !a.has(x));
  const extra = [...a].filter((x) => !e.has(x));
  if (!missing.length && !extra.length) {
    console.log(`  OK   ${label} (${expected.length} rows match)`);
    return 0;
  }
  console.log(`  DRIFT ${label}`);
  missing.forEach((x) => console.log(`    - missing on prod : ${x}`));
  extra.forEach((x) => console.log(`    + extra on prod   : ${x}`));
  return missing.length + extra.length;
}

const [expected, prod] = await Promise.all([snapshotExpected(), snapshotProd()]);

console.log("\n== RBAC drift: repo history (expected) vs production ==\n");
let drift = 0;
drift += diffList("RLS policies", expected.policies, prod.policies);
drift += diffList("role_permissions", expected.roleperms, prod.roleperms);

console.log("  -- helper functions --");
for (const name of new Set([...expected.funcs.keys(), ...prod.funcs.keys()])) {
  const e = expected.funcs.get(name);
  const p = prod.funcs.get(name);
  if (e && p && e === p) console.log(`  OK   ${name}()`);
  else if (!p) { console.log(`  DRIFT ${name}() missing on prod`); drift++; }
  else if (!e) { console.log(`  DRIFT ${name}() extra on prod (not in repo)`); drift++; }
  else { console.log(`  DRIFT ${name}() body differs`); drift++; }
}

console.log(`\n${drift === 0 ? "NO DRIFT — production matches the repo history." : `${drift} difference(s) found.`}\n`);
process.exit(drift === 0 ? 0 : 1);
