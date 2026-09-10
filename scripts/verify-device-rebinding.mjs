#!/usr/bin/env node
// Exercises PIN-first device re-binding through the real driver UI: a driver
// whose phone lost its device cookie must be able to take the job back with the
// PIN alone, and five wrong PINs must cool the link down rather than revoke it.
//
// Each browser context is its own cookie jar — i.e. a different phone.
//
// Usage:
//   node scripts/seed-driver-flow-test.mjs --seed      # prints a QR URL + PIN
//   node scripts/verify-device-rebinding.mjs <baseUrl> <token> <pin>
//   node scripts/seed-driver-flow-test.mjs --purge
//
// The token is hashed with DRIVER_ACCESS_TOKEN_SECRET from this machine, so
// point baseUrl at a deployment that uses the same secret — a locally seeded
// token will not resolve on production unless the secrets match.
//
// Destructive on the token it is given: it clears the binding, the attempt
// counter and any cooldown before starting. Only ever run it against a seeded
// smoke-test job.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import postgres from "postgres";

const [BASE, TOKEN, PIN] = process.argv.slice(2);
if (!BASE || !TOKEN || !PIN) {
  console.error("Usage: node scripts/verify-device-rebinding.mjs <baseUrl> <token> <pin>");
  process.exit(2);
}
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const envv = (k) => {
  const t = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const l = t.split(/\r?\n/).find((x) => x.startsWith(k + "="));
  return l ? l.slice(k.length + 1).trim().replace(/^["']|["']$/g, "") : null;
};
const sql = postgres((process.env.SUPABASE_DB_URL || envv("SUPABASE_DB_URL")).replace(/:6543\//, ":5432/"), {
  ssl: "require", prepare: false, max: 1, onnotice() {}
});
const ASSIGNMENT = TOKEN.split("_")[1];
const NL = String.fromCharCode(10);
const firstLine = (t) => t.split(NL)[0];
const lastLines = (t, n) => t.split(NL).slice(-n).join(" | ");

const out = [];
const check = (name, ok, detail = "") => {
  out.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const state = async () =>
  (await sql`
    select status, metadata->>'deviceHash' d, metadata->>'pinAttempts' a,
           metadata->>'pinLockedUntil' l, metadata->'deviceRebindings' r
    from driver_access_tokens where assignment_id = ${ASSIGNMENT}`)[0];

// Start from an unclaimed token every run, or the second run inherits the
// binding and cooldown the first one left behind.
await sql`
  update driver_access_tokens
  set metadata = metadata - 'deviceHash' - 'pinAttempts' - 'pinLockedUntil' - 'deviceRebindings'
  where assignment_id = ${ASSIGNMENT}`;

const browser = await chromium.launch();
const url = `${BASE}/driver?token=${encodeURIComponent(TOKEN)}`;

async function phone() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  return {
    open: async () => {
      await pg.goto(url, { waitUntil: "domcontentloaded" });
      await pg.waitForTimeout(700);
      return pg.locator("body").innerText();
    },
    reread: async () => pg.locator("body").innerText(),
    enter: async (pin) => {
      await pg.fill('input[inputmode="numeric"]', pin);
      await pg.click('button[type="submit"]');
      await pg.waitForTimeout(2200);
      return pg.locator("body").innerText();
    }
  };
}

const A = await phone();
let text = await A.open();
check("device A sees the plain PIN gate", text.includes("กรอกรหัสยืนยัน") && !text.includes("ย้ายงานมาที่เครื่องนี้"), firstLine(text));

await A.enter(PIN);
let st = await state();
check("device A's PIN bound the job to it", Boolean(st.d), st.d ? st.d.slice(0, 12) + "..." : "unbound");
const boundToA = st.d;

// A different phone with no cookies at all. The old build stopped dead here.
const B = await phone();
text = await B.open();
check(
  "device B is offered the takeover gate, not a dead end",
  text.includes("ย้ายงานมาที่เครื่องนี้"),
  text.includes("เปิดใช้บนอุปกรณ์อื่นแล้ว") ? "still the old dead-end notice" : firstLine(text)
);

text = await B.enter(PIN === "000000" ? "111111" : "000000");
check("wrong PIN on B is refused", text.includes("รหัสไม่ถูกต้อง"), text.match(/รหัสไม่ถูกต้อง[^\r\n]*/)?.[0] ?? "");
st = await state();
check("wrong PIN left the job on device A", st.d === boundToA);
check("wrong PIN was counted", st.a === "1", `pinAttempts=${st.a}`);

await B.enter(PIN);
st = await state();
check("correct PIN moved the job to device B", Boolean(st.d) && st.d !== boundToA);
check("the takeover is recorded", Array.isArray(st.r) && st.r.length === 1, JSON.stringify(st.r ?? null).slice(0, 80));
check("counter reset after success", st.a === "0", `pinAttempts=${st.a}`);

// Someone holding only the QR burns the attempts.
const C = await phone();
await C.open();
let lastText = "";
for (let i = 0; i < 5; i += 1) lastText = await C.enter("999999");
st = await state();
check("five wrong tries did NOT revoke the link", st.status === "active", `status=${st.status}`);
check("a cooldown was set instead", Boolean(st.l), st.l ?? "none");
const mins = st.l ? Math.round((new Date(st.l).getTime() - Date.now()) / 60000) : 0;
check("the cooldown is ~15 minutes", mins >= 14 && mins <= 15, `${mins} min`);
check("the message says a new QR is not needed", lastText.includes("ไม่ต้องขอ QR ใหม่"), lastText.match(/กรอกรหัสผิด[^\r\n]*/)?.[0] ?? lastLines(lastText, 2));

// A fourth phone — the driver's replacement handset — arrives mid-cooldown.
const D = await phone();
await D.open();
text = await D.enter(PIN);
check("even the right PIN waits out the cooldown", text.includes("กรุณารออีก"), lastLines(text, 3).slice(0, 90));

await sql`update driver_access_tokens set metadata = metadata - 'pinLockedUntil' where assignment_id = ${ASSIGNMENT}`;
await D.enter(PIN);
await new Promise((resolve) => setTimeout(resolve, 2500));
text = await D.reread();
check(
  "the same link works again once the wait is over — the gate is gone",
  !text.includes("กรุณารออีก") && !text.includes("รหัสไม่ถูกต้อง") && !text.includes("ย้ายงานมาที่เครื่องนี้"),
  firstLine(text).slice(0, 60)
);
st = await state();
check("the replacement handset now holds the job", Boolean(st.d) && st.d !== boundToA, `rebinds=${(st.r ?? []).length}`);

const failed = out.filter((r) => !r.ok).length;
console.log(`${NL}${out.length - failed}/${out.length} checks passed`);
await browser.close();
await sql.end();
process.exit(failed ? 1 : 0);
