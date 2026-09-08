#!/usr/bin/env node
// Seeds four auth users with distinct RBAC scopes for RLS verification.
//
//   super@tomp.test     global super_admin
//   orgadmin@tomp.test  global organization_admin (main org)
//   pm1@tomp.test        project_manager on Project A (project_members)
//   disp2@tomp.test      dispatcher on Project B (project_members)
//
// Also ensures the main org + two empty projects (A, B) exist.
//
// Usage:
//   node scripts/seed-test-users.mjs [--env <file>] [--reset]
//
// Connection: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_URL from
// the env file (default .env.local). Idempotent. Prints the ids the RLS test
// script (database/tests/rls_rbac_v2.sql) needs.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const argv = process.argv.slice(2);
const RESET = argv.includes("--reset");

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const PROJECT_A = "00000000-0000-4000-8000-00000000A001";
const PROJECT_B = "00000000-0000-4000-8000-00000000B002";
const TEST_PASSWORD = "tomp-test-1234";

const USERS = [
  { key: "super", email: "super@tomp.test", name: "ทดสอบ ซูเปอร์แอดมิน", scope: { type: "global", role: "super_admin" } },
  { key: "orgadmin", email: "orgadmin@tomp.test", name: "ทดสอบ แอดมินองค์กร", scope: { type: "global", role: "organization_admin" } },
  { key: "pm1", email: "pm1@tomp.test", name: "ทดสอบ ผู้จัดการโครงการ A", scope: { type: "project", role: "project_manager", project: PROJECT_A } },
  { key: "disp2", email: "disp2@tomp.test", name: "ทดสอบ ผู้จ่ายงาน B", scope: { type: "project", role: "dispatcher", project: PROJECT_B } }
];

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
    if (i <= 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}

function normalizeConn(raw) {
  return raw.replace(/:6543(\/|$|\?)/, ":5432$1");
}

async function findAuthUserByEmail(supabase, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 100) break;
  }
  return null;
}

async function main() {
  const envFile = argValue("--env") || path.join(ROOT, ".env.local");
  const values = { ...process.env, ...parseEnvFile(envFile) };
  const supabaseUrl = values.SUPABASE_URL || values.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = values.SUPABASE_SERVICE_ROLE_KEY || values.SUPABASE_SECRET_KEY;
  const dbUrl = values.SUPABASE_DB_URL || values.POSTGRES_URL || values.DATABASE_URL;

  if (!supabaseUrl || !serviceRoleKey || !dbUrl) {
    console.error(`ERROR: ${envFile} must include SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL.`);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const sql = postgres(normalizeConn(dbUrl), { max: 1, idle_timeout: 10, connect_timeout: 20, ssl: "require", prepare: false, onnotice: () => {} });

  try {
    if (RESET) {
      for (const u of USERS) {
        const existing = await findAuthUserByEmail(supabase, u.email);
        if (existing) {
          await supabase.auth.admin.deleteUser(existing.id);
          console.log(`deleted auth user ${u.email}`);
        }
      }
      await sql`delete from public.profiles where email = any(${USERS.map((u) => u.email)})`;
      await sql`delete from public.projects where id in (${PROJECT_A}, ${PROJECT_B})`;
      console.log("reset done");
      return;
    }

    // org
    await sql`
      insert into public.organizations (id, name, organization_type, status, metadata)
      values (${ORG_ID}, 'TOMP Operations', 'operator', 'active', '{"seed":"test-users"}'::jsonb)
      on conflict (id) do update set status = 'active'
    `;

    // projects A + B
    for (const [id, code, name] of [
      [PROJECT_A, "TEST-A", "โครงการทดสอบ A"],
      [PROJECT_B, "TEST-B", "โครงการทดสอบ B"]
    ]) {
      await sql`
        insert into public.projects (id, organization_id, project_code, project_name, start_date, end_date, timezone, status, metadata)
        values (${id}, ${ORG_ID}, ${code}, ${name}, current_date, current_date + 7, 'Asia/Bangkok', 'planning', '{"seed":"test-users"}'::jsonb)
        on conflict (id) do update set project_name = excluded.project_name
      `;
    }

    const result = { org: ORG_ID, projectA: PROJECT_A, projectB: PROJECT_B, users: {} };

    for (const u of USERS) {
      let authUser = await findAuthUserByEmail(supabase, u.email);
      if (!authUser) {
        const { data, error } = await supabase.auth.admin.createUser({
          email: u.email,
          password: TEST_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: u.name }
        });
        if (error) throw error;
        authUser = data.user;
      }

      const [profile] = await sql`
        insert into public.profiles (auth_user_id, organization_id, full_name, email, status, metadata)
        values (${authUser.id}, ${ORG_ID}, ${u.name}, ${u.email}, 'active', '{"seed":"test-users"}'::jsonb)
        on conflict (auth_user_id) do update set full_name = excluded.full_name, email = excluded.email, status = 'active'
        returning id
      `;

      // clear prior seed assignments for a clean idempotent state
      await sql`delete from public.user_role_assignments where profile_id = ${profile.id} and metadata ->> 'seed' = 'test-users'`;
      await sql`delete from public.project_members where profile_id = ${profile.id} and metadata ->> 'seed' = 'test-users'`;

      if (u.scope.type === "global") {
        await sql`
          insert into public.user_role_assignments (profile_id, organization_id, role_id, status, metadata)
          select ${profile.id}, ${ORG_ID}, r.id, 'active', '{"seed":"test-users"}'::jsonb
          from public.roles r where r.role_key = ${u.scope.role}
        `;
      } else {
        await sql`
          insert into public.project_members (project_id, profile_id, role_id, status, metadata)
          select ${u.scope.project}, ${profile.id}, r.id, 'active', '{"seed":"test-users"}'::jsonb
          from public.roles r where r.role_key = ${u.scope.role}
        `;
      }

      result.users[u.key] = { email: u.email, authUserId: authUser.id, profileId: profile.id, scope: u.scope };
      console.log(`seeded ${u.key.padEnd(9)} ${u.email.padEnd(20)} auth=${authUser.id}`);
    }

    console.log(`\npassword for all test users: ${TEST_PASSWORD}`);
    console.log("\n--- ids for database/tests/rls_rbac_v2.sql ---");
    console.log(JSON.stringify(result, null, 2));
    fs.writeFileSync(path.join(ROOT, "scripts", ".seed-test-users.json"), JSON.stringify(result, null, 2));
    console.log("\nwrote scripts/.seed-test-users.json");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(`ERROR: ${e?.message || e}`);
  process.exit(1);
});
