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

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
let copied = 0;
let removed = 0;

for (const { src, dest } of mapping) {
  const next = fs.readFileSync(path.join(SRC, src));
  const to = path.join(DEST, dest);
  const current = fs.existsSync(to) ? fs.readFileSync(to) : null;
  if (!current || !current.equals(next)) {
    fs.writeFileSync(to, next);
    copied += 1;
    console.log(`  synced   ${src}  ->  ${dest}`);
  }
}

for (const file of fs.readdirSync(DEST).filter((f) => f.endsWith(".sql"))) {
  if (!wantDest.has(file)) {
    fs.unlinkSync(path.join(DEST, file));
    removed += 1;
    console.log(`  removed  ${file}`);
  }
}

console.log(`\n${srcFiles.length} migration(s); ${copied} updated, ${removed} removed.`);
