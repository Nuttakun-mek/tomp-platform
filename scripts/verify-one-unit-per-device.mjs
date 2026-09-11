#!/usr/bin/env node
// A phone is in one vehicle at a time, so it holds one unit at a time.
//
// The binding was checked per token — "does this device hold *this* unit" — and
// never asked whether it already held another, so one browser could accumulate
// units. Each page opened, each kept its own PIN cookie, and the control room
// saw two vehicles moving in convoy that were one phone in one car.
//
// Usage: node scripts/verify-one-unit-per-device.mjs <baseUrl> <tokenA> <pinA> <tokenB> <pinB>
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import postgres from "postgres";

const [BASE, TOKEN_A, PIN_A, TOKEN_B, PIN_B] = process.argv.slice(2);
if (!BASE || !TOKEN_A || !PIN_A || !TOKEN_B || !PIN_B) {
  console.error("Usage: node scripts/verify-one-unit-per-device.mjs <baseUrl> <tokenA> <pinA> <tokenB> <pinB>");
  process.exit(2);
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const envv = (key) => {
  const text = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const line = text.split(/\r?\n/).find((row) => row.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "") : null;
};
const sql = postgres(envv("SUPABASE_DB_URL").replace(/:6543\//, ":5432/"), { ssl: "require", prepare: false, max: 1, onnotice() {} });

const unitA = TOKEN_A.split("_")[1];
const unitB = TOKEN_B.split("_")[1];
for (const unit of [unitA, unitB]) {
  await sql`update driver_access_tokens set metadata = metadata - 'deviceHash' - 'pinAttempts' - 'pinLockedUntil' where call_sign_id = ${unit}`;
}

const out = [];
const check = (name, ok, detail = "") => {
  out.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

async function claim(token, pin) {
  await page.goto(`${BASE}/driver?token=${encodeURIComponent(token)}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const before = await page.locator("body").innerText();
  if (before.includes("กรอกรหัส") || before.includes("ย้ายงาน")) {
    await page.fill('input[inputmode="numeric"]', pin);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !document.body.innerText.includes("กรอกรหัส"), { timeout: 15000 }).catch(() => {});
  }
  return page.locator("body").innerText();
}

await claim(TOKEN_A, PIN_A);
const boundToA = await sql`select metadata->>'deviceHash' d from driver_access_tokens where call_sign_id = ${unitA}`;
check("the first unit binds to this device", Boolean(boundToA[0]?.d));

await claim(TOKEN_B, PIN_B);
const afterB = await sql`
  select cs.call_sign, t.metadata->>'deviceHash' d
  from driver_access_tokens t join call_signs cs on cs.id = t.call_sign_id
  where t.call_sign_id in (${unitA}, ${unitB})`;
const held = afterB.filter((row) => row.d).length;
check("claiming the second unit releases the first", held === 1, `${held} unit(s) still bound`);

// The released unit's page must show the gate, not a job it cannot act on.
const backToA = await page.goto(`${BASE}/driver?token=${encodeURIComponent(TOKEN_A)}`, { waitUntil: "domcontentloaded" })
  .then(() => page.waitForTimeout(900))
  .then(() => page.locator("body").innerText());
check("the released unit asks for the PIN again", backToA.includes("กรอกรหัส") || backToA.includes("ย้ายงาน"), backToA.split("\n")[0].slice(0, 44));

const cookies = await ctx.cookies();
check("only one PIN cookie is kept", cookies.filter((c) => c.name.startsWith("dpin_") && c.value === "1").length === 1);

console.log(`\n${out.filter(Boolean).length}/${out.length} checks passed`);
await browser.close();
await sql.end();
process.exit(out.every(Boolean) ? 0 : 1);
