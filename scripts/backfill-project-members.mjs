#!/usr/bin/env node
// One-off: ensure every project's owner is an active project_members row
// (project_manager). Needed for projects created before Phase 3 added the
// auto-link, so their owners can see them once scoped reads are on.
//
// Usage: node scripts/backfill-project-members.mjs [--env <file>] [--dry-run]

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";

const ROOT = path.resolve(new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");

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

const envFile = argValue("--env") || path.join(ROOT, ".env.local");
const values = { ...process.env, ...parseEnvFile(envFile) };
const dbUrl = (values.SUPABASE_DB_URL || values.POSTGRES_URL || values.DATABASE_URL || "").replace(/:6543(\/|$|\?)/, ":5432$1");
if (!dbUrl) {
  console.error(`ERROR: ${envFile} must include SUPABASE_DB_URL.`);
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1, idle_timeout: 10, connect_timeout: 20, ssl: "require", prepare: false, onnotice: () => {} });

try {
  const missing = await sql`
    select p.id as project_id, p.project_code, p.owner_profile_id
    from public.projects p
    where p.owner_profile_id is not null
      and not exists (
        select 1 from public.project_members pm
        where pm.project_id = p.id and pm.profile_id = p.owner_profile_id and pm.status = 'active'
      )
  `;

  if (!missing.length) {
    console.log("nothing to backfill — every project owner is already a member");
  } else {
    console.log(`${missing.length} project(s) need an owner membership:`);
    for (const row of missing) console.log(`  ${row.project_code} -> profile ${row.owner_profile_id}`);
    if (!DRY) {
      for (const row of missing) {
        await sql`
          insert into public.project_members (project_id, profile_id, role_id, status, metadata)
          select ${row.project_id}, ${row.owner_profile_id}, r.id, 'active', '{"source":"backfill_owner"}'::jsonb
          from public.roles r where r.role_key = 'project_manager'
          on conflict (project_id, profile_id, role_id) do nothing
        `;
      }
      console.log("backfilled.");
    } else {
      console.log("(dry run — nothing written)");
    }
  }
} finally {
  await sql.end({ timeout: 5 });
}
