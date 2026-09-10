#!/usr/bin/env node
// Clean-database schema check (957 P1-2). Applies database/migrations/*.sql in
// order to a DISPOSABLE database, then asserts the schema that a fresh install
// must have. This proves the repo history can build the current schema — table
// presence in the live database does not.
//
// Usage:
//   SCHEMA_TEST_DATABASE_URL=postgres://... node scripts/verify-schema.mjs
//
// The target database is TRUNCATED of the `public` schema first, so never point
// this at production or staging. Spin up a throwaway:
//   docker run --rm -e POSTGRES_PASSWORD=pw -p 55432:5432 -d postgres:17
//   SCHEMA_TEST_DATABASE_URL=postgres://postgres:pw@localhost:55432/postgres node scripts/verify-schema.mjs

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const MIGRATIONS_DIR = path.join(ROOT, "database", "migrations");

const url = process.env.SCHEMA_TEST_DATABASE_URL;
if (!url) {
  console.error("SCHEMA_TEST_DATABASE_URL is required (a disposable database).");
  process.exit(2);
}
if (/prod|staging/i.test(url)) {
  console.error("Refusing to run against a URL that looks like prod/staging.");
  process.exit(2);
}

const REQUIRED_TABLES = [
  "organizations", "profiles", "projects", "project_days", "sessions", "missions",
  "call_signs", "call_sign_crew_events", "assignments", "timeline_events", "roles", "permissions",
  "role_permissions", "project_members", "user_role_assignments",
  "publish_snapshots", "publish_locks", "change_requests",
  "driver_access_tokens", "driver_checkins", "driver_issue_reports",
  "driver_notifications", "assignment_status_updates", "gps_locations",
  "driver_location_sessions"
];

// (table, constraint substring) — a representative sample, not exhaustive.
const REQUIRED_CONSTRAINTS = [
  ["projects", "projects_status_check"],
  ["assignments", "assignments_status_check"],
  ["missions", "missions_project_code_unique"],
  ["publish_locks", "publish_locks_project_active_unique"],
  ["change_requests", "change_requests_status_check"]
];

const sql = postgres(url, { max: 1, onnotice: () => {} });
const failures = [];

try {
  console.log("Resetting public schema…");
  await sql.unsafe("drop schema if exists public cascade; create schema public;");
  await sql.unsafe("grant all on schema public to public;");

  // Supabase supplies these; stub the minimum a fresh plain-Postgres needs so
  // the migrations (which reference auth.users / auth.uid()) apply.
  await sql.unsafe(`
    create extension if not exists pgcrypto;
    drop schema if exists auth cascade;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
    create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create or replace function auth.role() returns text language sql stable as $$ select 'authenticated'::text $$;
    drop schema if exists storage cascade;
    create schema storage;
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
  `);

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const body = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    try {
      await sql.unsafe(body);
      console.log(`  applied  ${file}`);
    } catch (error) {
      failures.push(`${file} failed to apply: ${error.message}`);
      console.log(`  FAILED   ${file}  ${error.message}`);
      break; // a broken migration blocks everything after it
    }
  }

  if (failures.length === 0) {
    const tables = (
      await sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`
    ).map((r) => r.table_name);
    for (const t of REQUIRED_TABLES) {
      if (!tables.includes(t)) failures.push(`missing table: public.${t}`);
    }

    const rls = await sql`
      select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
    `;
    for (const row of rls) {
      if (REQUIRED_TABLES.includes(row.relname)) failures.push(`RLS not enabled: public.${row.relname}`);
    }

    const constraints = (
      await sql`select conname from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public'`
    ).map((r) => r.conname);
    for (const [table, name] of REQUIRED_CONSTRAINTS) {
      if (!constraints.some((c) => c.includes(name))) failures.push(`missing constraint ${name} (on ${table})`);
    }

    const roleKeys = (await sql`select role_key from public.roles`).map((r) => r.role_key);
    for (const key of ["super_admin", "project_manager", "dispatcher", "coordinator", "customer_viewer", "driver"]) {
      if (!roleKeys.includes(key)) failures.push(`roles seed missing: ${key}`);
    }
  }
} catch (error) {
  failures.push(`fatal: ${error.message}`);
} finally {
  await sql.end();
}

if (failures.length) {
  console.error(`\nSchema verify FAILED:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nSchema verify passed — 0001 → latest builds a clean schema with RLS + seeds.");
