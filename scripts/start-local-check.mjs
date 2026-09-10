#!/usr/bin/env node
// Start apps/web locally with the repo-root .env.local loaded.
//
// `next start` runs inside apps/web and only reads apps/web/.env.local, which
// does not exist — the real file is at the repo root, shared by the scripts. The
// middleware runs on the Edge runtime and reads process.env directly, with no
// filesystem fallback, so without this it sees no Supabase config and bounces
// every request to /login?reason=missing-auth-config.
//
// Usage: node scripts/start-local-check.mjs [port]

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.argv[2] || "3100";

const envPath = path.join(ROOT, ".env.local");
if (!fs.existsSync(envPath)) {
  console.error(`No .env.local at ${envPath}`);
  process.exit(2);
}

const env = { ...process.env };
let loaded = 0;
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) continue;
  env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  loaded += 1;
}

console.log(`Loaded ${loaded} variables from .env.local`);
console.log(`Starting http://localhost:${port}`);

spawn("npx", ["next", "start", "-p", port], {
  cwd: path.join(ROOT, "apps", "web"),
  env,
  stdio: "inherit",
  shell: true
});
