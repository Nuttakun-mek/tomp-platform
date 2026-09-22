#!/usr/bin/env node
// End-to-end driver flow smoke runner:
// seed smoke data -> simulate the mobile shell -> purge smoke data.
//
// Usage:
//   TOMP_BASE_URL=https://<staging> node scripts/driver-flow-smoke.mjs
//   node scripts/driver-flow-smoke.mjs https://<staging> --keep
//   node scripts/driver-flow-smoke.mjs https://tomp-platform.vercel.app --allow-production

import { spawnSync } from "node:child_process";
import process from "node:process";

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const allowProduction = args.includes("--allow-production");
const baseUrlArg = args.find((arg) => !arg.startsWith("--"));
const baseUrlRaw = baseUrlArg || process.env.TOMP_BASE_URL || "";

if (!baseUrlRaw) {
  console.error("A staging base URL is required. Set TOMP_BASE_URL or pass it as the first argument.");
  console.error("Production is blocked unless --allow-production is provided explicitly.");
  process.exit(2);
}

const baseUrl = baseUrlRaw.replace(/\/$/, "");
const host = new URL(baseUrl).hostname;
const isProductionHost = host === "tomp-platform.vercel.app";

if (isProductionHost && !allowProduction) {
  console.error("Refusing to run driver flow smoke against production without --allow-production.");
  console.error("Use a staging deployment or run: node scripts/driver-flow-smoke.mjs https://tomp-platform.vercel.app --allow-production");
  process.exit(2);
}

const env = { ...process.env, TOMP_BASE_URL: baseUrl };

function run(label, command, commandArgs, options = {}) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, commandArgs, {
    env,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
  });
  if (options.capture) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}`);
  }
  return result.stdout || "";
}

function parseSeedOutput(output) {
  const token = output.match(/\/driver\/(tomp_[^\s]+)/)?.[1];
  const pin = output.match(/\bPIN\s+(\d{6})\b/)?.[1];
  if (!token || !pin) {
    throw new Error("Could not parse QR token and PIN from seed output.");
  }
  return { token, pin };
}

let seeded = false;
try {
  const seedOutput = run("seed driver smoke data", "node", ["scripts/seed-driver-flow-test.mjs", "--seed"], { capture: true });
  seeded = true;
  const { token, pin } = parseSeedOutput(seedOutput);
  run("simulate mobile driver shell", "node", ["scripts/simulate-mobile-shell.mjs", baseUrl, token, pin]);
  console.log("\nDriver flow smoke completed.");
} catch (error) {
  console.error(`\nFAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (seeded && !keep) {
    try {
      run("purge driver smoke data", "node", ["scripts/seed-driver-flow-test.mjs", "--purge"]);
    } catch (error) {
      console.error(`\nCleanup failed: ${error.message}`);
      process.exitCode = 1;
    }
  } else if (seeded) {
    console.log("\nSmoke data kept because --keep was provided.");
  }
}
