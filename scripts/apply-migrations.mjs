#!/usr/bin/env node
// Applies database/migrations/*.sql (and optionally database/seed/*.sql) to a
// Supabase Postgres database, tracking what has run in public.schema_migrations_tomp.
//
// Usage:
//   node scripts/apply-migrations.mjs [options]
//
// Options:
//   --dry-run     Show what would run, connect and read state, but apply nothing.
//   --seed        Also apply database/seed/*.sql after migrations (idempotent seeds).
//   --direct      Do NOT rewrite the connection port; use SUPABASE_DB_URL as-is.
//   --url <conn>  Override the connection string (else SUPABASE_DB_URL / .env.local).
//   --yes         Skip the confirmation prompt.
//
// Connection: reads SUPABASE_DB_URL from the environment or .env.local. The
// Supabase transaction pooler (port 6543) cannot run multi-statement DDL
// transactions, so the port is rewritten to 5432 (session pooler) unless
// --direct is passed.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const MIGRATIONS_DIR = path.join(ROOT, "database", "migrations");
const SEED_DIR = path.join(ROOT, "database", "seed");

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const RUN_SEED = args.has("--seed");
const DIRECT = args.has("--direct");
const ASSUME_YES = args.has("--yes");

function getUrlArg() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--url");
  return i >= 0 ? argv[i + 1] : undefined;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key) out[key] = value;
  }
  return out;
}

function resolveConnectionString() {
  const fromArg = getUrlArg();
  if (fromArg) return fromArg;
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  for (const candidate of [path.join(ROOT, ".env.local"), path.join(ROOT, ".env")]) {
    const parsed = parseEnvFile(candidate);
    if (parsed.SUPABASE_DB_URL) return parsed.SUPABASE_DB_URL;
  }
  return undefined;
}

function normalizeConnectionString(raw) {
  if (DIRECT) return raw;
  // Supabase transaction pooler -> session pooler for safe multi-statement DDL.
  return raw.replace(/:6543(\/|$|\?)/, ":5432$1");
}

function maskConnectionString(raw) {
  return raw.replace(/:\/\/([^:/@]+):[^@]*@/, "://$1:****@");
}

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function listSqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, fullPath: path.join(dir, name), sql: fs.readFileSync(path.join(dir, name), "utf8") }));
}

async function confirm(question) {
  if (ASSUME_YES || DRY_RUN) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(`${question} [y/N] `, resolve));
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

async function ensureTrackingTable(sql) {
  await sql.unsafe(`
    create table if not exists public.schema_migrations_tomp (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
    alter table public.schema_migrations_tomp add column if not exists checksum text;
    alter table public.schema_migrations_tomp enable row level security;
    revoke all on public.schema_migrations_tomp from anon;
    revoke all on public.schema_migrations_tomp from authenticated;
    do $$
    begin
      if exists (select 1 from pg_roles where rolname = 'service_role') then
        grant select, insert, update, delete on public.schema_migrations_tomp to service_role;
      end if;
    end
    $$;
    comment on table public.schema_migrations_tomp is
      'Internal TOMP migration tracking table. RLS enabled and client roles revoked; server/service role only.';
  `);
}

function quote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function applyFile(sql, table, file) {
  const checksum = sha256(file.sql);
  // Whole migration + its tracking row commit atomically.
  const script = [
    "begin;",
    file.sql,
    `insert into public.${table} (filename, checksum) values (${quote(file.name)}, ${quote(checksum)})
       on conflict (filename) do update set checksum = excluded.checksum, applied_at = now();`,
    "commit;"
  ].join("\n");
  try {
    await sql.unsafe(script);
  } catch (error) {
    try {
      await sql.unsafe("rollback;");
    } catch {
      // ignore rollback errors
    }
    throw error;
  }
}

async function main() {
  const rawConn = resolveConnectionString();
  if (!rawConn) {
    console.error("ERROR: no connection string. Set SUPABASE_DB_URL (env or .env.local) or pass --url <conn>.");
    process.exit(1);
  }
  const conn = normalizeConnectionString(rawConn);

  console.log(`Target      : ${maskConnectionString(conn)}`);
  console.log(`Mode        : ${DRY_RUN ? "DRY RUN (no writes)" : "APPLY"}`);
  console.log(`Migrations  : ${MIGRATIONS_DIR}`);
  if (RUN_SEED) console.log(`Seeds       : ${SEED_DIR}`);
  console.log("");

  const migrations = listSqlFiles(MIGRATIONS_DIR);
  if (migrations.length === 0) {
    console.error(`ERROR: no .sql files found in ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const sql = postgres(conn, {
    max: 1,
    idle_timeout: 10,
    connect_timeout: 15,
    ssl: "require",
    prepare: false,
    onnotice: () => {}
  });

  let exitCode = 0;
  try {
    const version = await sql`select current_database() as db, version() as v`;
    console.log(`Connected   : ${version[0].db} / ${version[0].v.split(" ").slice(0, 2).join(" ")}\n`);

    if (!DRY_RUN) await ensureTrackingTable(sql);

    const trackingExists = await sql`select to_regclass('public.schema_migrations_tomp') is not null as ok`;
    const hasChecksumColumn =
      trackingExists[0].ok &&
      (await sql`select 1 from information_schema.columns where table_schema='public' and table_name='schema_migrations_tomp' and column_name='checksum'`).length > 0;
    const applied = trackingExists[0].ok
      ? new Map(
          (
            await sql.unsafe(
              `select filename, ${hasChecksumColumn ? "checksum" : "null::text as checksum"} from public.schema_migrations_tomp`
            )
          ).map((r) => [r.filename, r.checksum])
        )
      : new Map();

    const pending = [];
    for (const file of migrations) {
      if (!applied.has(file.name)) {
        pending.push(file);
        console.log(`  pending   ${file.name}`);
        continue;
      }
      const priorChecksum = applied.get(file.name);
      if (priorChecksum == null) {
        console.log(`  applied   ${file.name}  (no checksum on record)`);
      } else if (priorChecksum !== sha256(file.sql)) {
        console.log(`  CHANGED   ${file.name}  (already applied with a different checksum — not re-run)`);
      } else {
        console.log(`  applied   ${file.name}`);
      }
    }
    console.log("");

    if (pending.length === 0) {
      console.log("Nothing to apply. Database is up to date.");
    } else if (DRY_RUN) {
      console.log(`DRY RUN: ${pending.length} migration(s) would be applied.`);
    } else {
      const ok = await confirm(`Apply ${pending.length} migration(s) to ${maskConnectionString(conn)}?`);
      if (!ok) {
        console.log("Aborted.");
        return;
      }
      for (const file of pending) {
        process.stdout.write(`  applying  ${file.name} ... `);
        await applyFile(sql, "schema_migrations_tomp", file);
        console.log("done");
      }
      console.log(`\nApplied ${pending.length} migration(s).`);
    }

    if (RUN_SEED) {
      const seeds = listSqlFiles(SEED_DIR);
      console.log(`\nSeeds (${seeds.length} file(s), idempotent):`);
      if (DRY_RUN) {
        for (const file of seeds) console.log(`  would run ${file.name}`);
      } else {
        for (const file of seeds) {
          process.stdout.write(`  seeding   ${file.name} ... `);
          await sql.unsafe(`begin;\n${file.sql}\ncommit;`);
          console.log("done");
        }
      }
    }
  } catch (error) {
    exitCode = 1;
    console.error(`\nERROR: ${error?.message || error}`);
    if (error?.code) console.error(`  pg code: ${error.code}`);
    if (error?.hint) console.error(`  hint: ${error.hint}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
  process.exit(exitCode);
}

main();
