#!/usr/bin/env node
// RLS role-matrix check (957 P2-3). Applies every migration to a disposable
// Postgres, seeds a project with one member and one non-member, then asserts
// what each persona can read/write through Row Level Security:
//   anon, authenticated non-member, authenticated project member,
//   authenticated super_admin, service_role.
//
// Usage:
//   RLS_TEST_DATABASE_URL=postgres://... node scripts/verify-rls-matrix.mjs
// Point this at a throwaway database only (the public schema is dropped).

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const MIGRATIONS_DIR = path.join(ROOT, "database", "migrations");

const url = process.env.RLS_TEST_DATABASE_URL;
if (!url) {
  console.error("RLS_TEST_DATABASE_URL is required (a disposable database).");
  process.exit(2);
}
if (/prod|staging/i.test(url)) {
  console.error("Refusing to run against a URL that looks like prod/staging.");
  process.exit(2);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const failures = [];

// Each persona runs inside one transaction so SET LOCAL ROLE / claims stick for
// the whole check and are rolled back after. A denied query aborts the tx, so
// keep one probe per persona call.
async function asPersona(role, uid, fn) {
  try {
    return await sql.begin(async (tx) => {
      await tx.unsafe(`set local role ${role}`);
      await tx.unsafe(`select set_config('request.jwt.claims', ${uid ? `'${JSON.stringify({ sub: uid, role })}'` : "''"}, true)`);
      await tx.unsafe(`select set_config('test.auth_uid', ${uid ? `'${uid}'` : "''"}, true)`);
      return await fn(tx);
    });
  } catch (e) {
    return e.code === "42501" ? "denied" : `err:${e.code || e.message}`;
  }
}

const countIn = (tx) => async (table) => {
  const rows = await tx.unsafe(`select count(*)::int as n from public.${table}`);
  return rows[0].n;
};

function expect(label, actual, wanted) {
  // "sees nothing" is satisfied by 0 rows OR a hard permission denial.
  const ok = actual === wanted || (wanted === 0 && actual === "denied");
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (got ${actual}, want ${wanted})`);
  if (!ok) failures.push(`${label}: got ${actual}, want ${wanted}`);
}

try {
  console.log("Building schema…");
  await sql.unsafe("drop schema if exists public cascade; create schema public; grant all on schema public to public;");
  await sql.unsafe(`
    create extension if not exists pgcrypto;
    drop schema if exists auth cascade; create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
    create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.auth_uid', true), '')::uuid $$;
    create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', 'anon') $$;
    drop schema if exists storage cascade; create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, created_at timestamptz default now(), metadata jsonb);
    create or replace function storage.foldername(name text) returns text[] language sql stable as $$ select string_to_array(name, '/') $$;
    do $$ begin
      if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists (select 1 from pg_publication where pubname='supabase_realtime') then create publication supabase_realtime; end if;
    end $$;
    -- Force it even if the role pre-exists from a prior script on the same DB
    -- (the CI database job runs verify-schema, verify-rls and load-scenario
    -- against one Postgres). Supabase service_role is BYPASSRLS.
    alter role service_role with bypassrls;
    grant usage on schema auth, storage to authenticated, anon, service_role;
  `);

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await sql.unsafe(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
  console.log(`Applied ${files.length} migrations.`);

  // ---- seed -------------------------------------------------------------
  const [org] = await sql`insert into organizations (name) values ('RLS Org') returning id`;
  const mkUser = async (email) => {
    const [u] = await sql`insert into auth.users (email) values (${email}) returning id`;
    const [p] = await sql`insert into profiles (auth_user_id, organization_id, full_name, email) values (${u.id}, ${org.id}, ${email}, ${email}) returning id`;
    return { authId: u.id, profileId: p.id };
  };
  const admin = await mkUser("admin@test");
  const member = await mkUser("member@test");
  const outsider = await mkUser("outsider@test");

  const [pmRole] = await sql`select id from roles where role_key = 'project_manager'`;
  const [saRole] = await sql`select id from roles where role_key = 'super_admin'`;
  await sql`insert into user_role_assignments (profile_id, role_id, status) values (${admin.profileId}, ${saRole.id}, 'active')`.catch(() => {});

  const [projA] = await sql`insert into projects (organization_id, project_code, project_name, start_date, end_date, status) values (${org.id}, 'RLS-A', 'A', '2026-01-01', '2026-01-02', 'planning') returning id`;
  const [projB] = await sql`insert into projects (organization_id, project_code, project_name, start_date, end_date, status) values (${org.id}, 'RLS-B', 'B', '2026-01-01', '2026-01-02', 'planning') returning id`;
  await sql`insert into project_members (project_id, profile_id, role_id, status) values (${projA.id}, ${member.profileId}, ${pmRole.id}, 'active')`;

  // ---- assertions -----------------------------------------------------
  console.log("\nProjects visible per persona (2 projects exist):");
  expect("anon sees no projects", await asPersona("anon", null, (tx) => countIn(tx)("projects")), 0);
  expect("outsider (member of nothing) sees 0", await asPersona("authenticated", outsider.authId, (tx) => countIn(tx)("projects")), 0);
  expect("member sees only project A", await asPersona("authenticated", member.authId, (tx) => countIn(tx)("projects")), 1);
  expect("super_admin sees both", await asPersona("authenticated", admin.authId, (tx) => countIn(tx)("projects")), 2);
  expect("service_role sees both (bypassrls)", await asPersona("service_role", null, (tx) => countIn(tx)("projects")), 2);

  // Design: there are no write RLS policies. Every INSERT/UPDATE/DELETE through
  // the cookie-bound `authenticated` client is denied by RLS default-deny;
  // writes go only through server actions on the service-role client, which
  // self-check with requirePermission(). So the matrix asserts that even a
  // project member cannot write directly — the app layer is the write guard.
  console.log("\nWrite guard — the authenticated (cookie) client cannot write directly:");
  const insertProbe = (uid, label) =>
    asPersona("authenticated", uid, async (tx) => {
      await tx`insert into call_signs (project_id, call_sign) values (${projA.id}, ${label})`;
      return "allowed";
    });
  expect("non-member direct insert denied", await insertProbe(outsider.authId, "X1"), "denied");
  expect("project member direct insert also denied (writes are app-layer only)", await insertProbe(member.authId, "M1"), "denied");
  expect("service_role direct insert allowed (server-action transport)", await asPersona("service_role", null, async (tx) => {
    await tx`insert into call_signs (project_id, call_sign) values (${projB.id}, 'S1')`;
    return "allowed";
  }), "allowed");
} catch (error) {
  failures.push(`fatal: ${error.message}`);
  console.error(error);
} finally {
  await sql.end();
}

if (failures.length) {
  console.error(`\nRLS matrix FAILED:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nRLS matrix passed.");
