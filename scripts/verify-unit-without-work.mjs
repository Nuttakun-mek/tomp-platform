#!/usr/bin/env node
// A crewed unit gets its QR the moment it is created, before any work exists —
// that is now the ordinary state of a new unit, not an edge case. This walks
// that QR through the PIN and checks the driver is told they are verified and
// waiting, rather than that their link is broken, which is what the page said
// before: a driver holding a perfectly good printed sheet would phone the
// control room about it.
//
// Usage:
//   node scripts/verify-unit-without-work.mjs <baseUrl> <token> <pin>
//
// Destructive on the token it is given: it clears the device binding first so
// the run is repeatable. Only point it at a seeded unit.

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import postgres from "postgres";

const [BASE, TOKEN, PIN] = process.argv.slice(2);
if (!BASE || !TOKEN || !PIN) {
  console.error("Usage: node scripts/verify-unit-without-work.mjs <baseUrl> <token> <pin>");
  process.exit(2);
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const envv = (key) => {
  const text = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const line = text.split(/\r?\n/).find((row) => row.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "") : null;
};

const sql = postgres(envv("SUPABASE_DB_URL").replace(/:6543\//, ":5432/"), {
  ssl: "require",
  prepare: false,
  max: 1,
  onnotice() {}
});

// A previous run leaves the token bound to its own browser; a fresh one would
// then meet the takeover gate instead of the plain one.
const callSignId = TOKEN.split("_")[1];
await sql`
  update driver_access_tokens
  set metadata = metadata - 'deviceHash' - 'pinAttempts' - 'pinLockedUntil' - 'deviceRebindings'
  where call_sign_id = ${callSignId}`;

const out = [];
const check = (name, ok, detail = "") => {
  out.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(`${BASE}/driver?token=${encodeURIComponent(TOKEN)}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
const gate = await page.locator("body").innerText();
check("the PIN still guards a unit with no work", gate.includes("กรอกรหัสยืนยัน"), gate.split("\n")[0]);

await page.fill('input[inputmode="numeric"]', PIN);
await page.click('button[type="submit"]');
// The action re-binds the device and refreshes; wait for the gate to go rather
// than guessing at a delay.
await page
  .waitForFunction(() => !document.body.innerText.includes("กรอกรหัสยืนยัน"), { timeout: 15000 })
  .catch(() => {});
const text = await page.locator("body").innerText();

check("a valid QR with no work is not called broken", !text.includes("ไม่พบงานสำหรับลิงก์นี้"));
check("the driver is told they are verified and waiting", text.includes("รอรับงาน"), text.split("\n")[0]);
check("the unit is shown so the sheet can be matched to the vehicle", text.includes("NOJOB-01") && text.includes("นจ-0001"));
check("there is a way to check again", text.includes("ตรวจสอบงานใหม่"));

console.log(`\n${out.filter(Boolean).length}/${out.length} checks passed`);
await browser.close();
await sql.end();
process.exit(out.every(Boolean) ? 0 : 1);
