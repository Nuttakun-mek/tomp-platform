#!/usr/bin/env node
// Mirrors database/migrations/*.sql into supabase/migrations/ so the Supabase
// CLI local stack (supabase start / supabase db reset) applies the same schema
// as the cloud migration runner (scripts/apply-migrations.mjs).
//
// database/migrations/ is the single source of truth. It intentionally reuses
// number prefixes (e.g. two 0007_*, two 0009_*) for "additive" migrations. The
// Supabase CLI keys its own tracking table on the prefix and rejects duplicates,
// so the mirror is renumbered to a strict sequential 4-digit prefix while
// preserving lexical (apply) order. The rest of each filename is unchanged.
//
//   node scripts/sync-supabase-migrations.mjs           # regenerate the mirror
//   node scripts/sync-supabase-migrations.mjs --check   # exit 1 if it is stale
//
// --check is the CI guard: a merge that adds migrations on two branches leaves
// the committed mirror inconsistent (duplicate prefixes → the CLI rejects a
// local db reset). CI fails until someone runs the sync and commits it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHECK = process.argv.slice(2).includes("--check");

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const SRC = path.join(ROOT, "database", "migrations");
const DEST = path.join(ROOT, "supabase", "migrations");

fs.mkdirSync(DEST, { recursive: true });

const srcFiles = fs
  .readdirSync(SRC)
  .filter((f) => f.endsWith(".sql"))
  .sort();

// original name -> mirrored name
const mapping = srcFiles.map((name, i) => {
  const withoutPrefix = name.replace(/^\d+[_-]?/, "");
  const seq = String(i + 1).padStart(4, "0");
  return { src: name, dest: `${seq}_${withoutPrefix}` };
});

const wantDest = new Set(mapping.map((m) => m.dest));
const drift = [];

for (const { src, dest } of mapping) {
  const next = fs.readFileSync(path.join(SRC, src));
  const to = path.join(DEST, dest);
  const current = fs.existsSync(to) ? fs.readFileSync(to) : null;
  if (current && current.equals(next)) continue;

  if (CHECK) {
    drift.push(`  stale    ${dest}  (differs from database/migrations/${src})`);
  } else {
    fs.writeFileSync(to, next);
    console.log(`  synced   ${src}  ->  ${dest}`);
  }
}

for (const file of fs.readdirSync(DEST).filter((f) => f.endsWith(".sql"))) {
  if (wantDest.has(file)) continue;
  if (CHECK) {
    drift.push(`  orphan   ${file}  (no matching database/migrations/ file)`);
  } else {
    fs.unlinkSync(path.join(DEST, file));
    console.log(`  removed  ${file}`);
  }
}

if (CHECK) {
  if (drift.length === 0) {
    console.log(`supabase/migrations/ is in sync (${srcFiles.length} migration(s)).`);
    process.exit(0);
  }
  console.error("supabase/migrations/ is out of sync with database/migrations/:\n");
  drift.forEach((line) => console.error(line));
  console.error("\nFix: node scripts/sync-supabase-migrations.mjs  (then commit the result)");
  process.exit(1);
}

console.log(`\n${srcFiles.length} migration(s) mirrored.`);
