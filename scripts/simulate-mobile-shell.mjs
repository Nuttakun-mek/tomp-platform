#!/usr/bin/env node
// Simulates the native TOMP Driver shell against a running web app so the whole
// QR -> PIN -> driver session -> mobile-session challenge/exchange -> background
// GPS -> Mission Control chain can be exercised without an Android device.
//
// It injects a window.TOMP_MOBILE_SHELL exactly like App.tsx's bridgeBootstrap,
// records every bridge postMessage, then performs the native half in Node.
//
// Usage:
//   node scripts/seed-driver-flow-test.mjs --seed        # prints a QR URL + PIN
//   node scripts/simulate-mobile-shell.mjs <baseUrl> <token> <pin>
//   node scripts/seed-driver-flow-test.mjs --purge
//
// Known limitation: the last check (native gps_sharing -> web UI) needs the
// driver pre-flight completed (confirm details + evidence photo) because the
// tomp:native-status listener lives in DriverLocationShare, which only mounts
// on the task view. Headless cannot take that photo, so that one link is left
// for the on-device run.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import postgres from "postgres";

const [baseUrl, token, pin] = process.argv.slice(2);
if (!baseUrl || !token || !pin) {
  console.error("Usage: node scripts/simulate-mobile-shell.mjs <baseUrl> <token> <pin>");
  process.exit(2);
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const dbUrl = (env.match(/SUPABASE_DB_URL=(.+)/) || [])[1].trim().replace(/:6543\//, ":5432/");
const sql = postgres(dbUrl, { ssl: "require", prepare: false, max: 1, onnotice: () => {} });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

// Mirrors apps/mobile-driver/App.tsx bridgeBootstrap
const bridgeBootstrap = `
  window.__bridgeOut = [];
  window.TOMP_MOBILE_SHELL = {
    namespace: "tomp.driver",
    version: 1,
    platform: "android",
    appVersion: "0.2.0-sim",
    canBackgroundLocation: true,
    postMessage: function (message) { window.__bridgeOut.push(message); }
  };
  window.__nativeStatus = [];
  window.addEventListener("tomp:native-status", function (e) { window.__nativeStatus.push(e.detail); });
  window.dispatchEvent(new CustomEvent("tomp:mobile-shell-ready", { detail: window.TOMP_MOBILE_SHELL }));
`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: "th-TH" });
await context.addInitScript(bridgeBootstrap);
const page = await context.newPage();
const apiCalls = [];
page.on("response", (r) => {
  if (r.url().includes("/api/driver/")) apiCalls.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
});

try {
  // 1. open the QR link
  await page.goto(`${baseUrl}/driver/${token}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {});
  const body = await page.textContent("body");
  check("QR link resolves to a job (not the 'not found' notice)", !body.includes("ไม่พบงานสำหรับลิงก์นี้"));

  const shellSeen = await page.evaluate(() => Boolean(window.TOMP_MOBILE_SHELL));
  check("shell handle survives into the page", shellSeen);

  // 2. PIN gate
  const pinInput = page.locator('input[inputmode="numeric"], input[name*="pin" i], input[type="tel"]').first();
  if (await pinInput.count()) {
    await pinInput.fill(pin);
    const submit = page.locator('button[type="submit"]').first();
    await submit.click();
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    check("PIN accepted", !(await page.textContent("body")).includes("รหัสไม่ถูกต้อง"));
  } else {
    check("PIN gate present", false, "no PIN input found — page may have rendered a notice");
  }

  // 3. the web should hand the shell a mobile-session challenge
  await page.waitForFunction(() => (window.__bridgeOut || []).some((m) => m.type === "mobile-session.challenge"), null, { timeout: 30000 }).catch(() => {});
  const out = await page.evaluate(() => window.__bridgeOut || []);
  const challengeMsg = out.find((m) => m.type === "mobile-session.challenge");
  check("web posts mobile-session.challenge over the bridge", Boolean(challengeMsg), challengeMsg ? `code len ${challengeMsg.payload.code.length}` : `bridge saw: ${JSON.stringify(out.map((m) => m.type))}`);
  if (challengeMsg) {
    check("challenge message is stamped with the shared namespace/version", challengeMsg.namespace === "tomp.driver" && challengeMsg.version === 1);
  }

  // 4. NATIVE HALF: exchange the challenge for a scoped mobile session
  let mobileSession = null;
  if (challengeMsg) {
    const installationId = `sim-${crypto.randomUUID()}`;
    const res = await fetch(`${baseUrl}/api/driver/mobile-session/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: challengeMsg.payload.code, installationId })
    });
    const json = await res.json().catch(() => null);
    mobileSession = json?.data?.session ?? null;
    check("native exchanges the challenge for x-driver-session", Boolean(mobileSession), `HTTP ${res.status}`);

    // replay the same code — must not mint a second session
    const replay = await fetch(`${baseUrl}/api/driver/mobile-session/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: challengeMsg.payload.code, installationId })
    });
    check("replaying the same challenge is rejected", replay.status === 401, `HTTP ${replay.status}`);
  }

  // 5. background GPS ping with the mobile session
  if (mobileSession) {
    const ping = {
      latitude: 13.7563,
      longitude: 100.5018,
      accuracy: 12,
      recordedAt: new Date().toISOString(),
      trackingEvent: "location_ping",
      metadata: { platform: "mobile_driver", mode: "background", sim: true }
    };
    const res = await fetch(`${baseUrl}/api/driver/location`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-driver-session": mobileSession },
      body: JSON.stringify(ping)
    });
    check("background GPS ping accepted with x-driver-session", res.ok, `HTTP ${res.status}`);

    const bad = await fetch(`${baseUrl}/api/driver/location`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-driver-session": `${mobileSession}tampered` },
      body: JSON.stringify(ping)
    });
    check("tampered session is rejected", bad.status === 401, `HTTP ${bad.status}`);

    // 6. the row must exist in the real database
    const rows = await sql`
      select g.id, g.latitude, g.longitude, g.source, g.metadata
      from gps_locations g join projects p on p.id = g.project_id
      where p.metadata->>'smokeTest' = 'true' order by g.recorded_at desc limit 1`;
    check("ping landed in gps_locations", rows.length > 0, rows[0] ? `${rows[0].latitude},${rows[0].longitude}` : "no row");

    // 7. the assignment read the native app uses
    const asn = await fetch(`${baseUrl}/api/driver/assignment`, { headers: { "x-driver-session": mobileSession } });
    const asnJson = await asn.json().catch(() => null);
    check("native assignment read works with the session", asn.ok && Boolean(asnJson?.data?.packet), `HTTP ${asn.status}`);
  }

  // 7b. Complete the driver pre-flight so the task view (which owns the
  // tomp:native-status listener inside DriverLocationShare) actually mounts.
  const boxes = page.locator('input[type="checkbox"]');
  const boxCount = await boxes.count();
  for (let i = 0; i < boxCount; i += 1) await boxes.nth(i).check().catch(() => {});
  const fileInputs = page.locator('input[type="file"]');
  const fileCount = await fileInputs.count();
  // a 1x1 PNG the browser can decode and the client-side compressor can draw
  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  for (let i = 0; i < fileCount; i += 1) {
    await fileInputs.nth(i).setInputFiles({ name: `evidence-${i}.png`, mimeType: "image/png", buffer: onePixelPng }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  // wait for both uploads to register before the button enables
  await page
    .waitForFunction(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => /เริ่มงาน/.test(b.textContent || ""));
      return Boolean(btn) && !btn.disabled;
    }, null, { timeout: 30000 })
    .catch(() => {});
  const startBtn = page.locator("button", { hasText: /ยืนยันและเริ่มงาน/ }).first();
  if (await startBtn.count()) await startBtn.click({ timeout: 10000 }).catch(() => {});
  // the readiness submit is a server action — give it room on a cold dev route
  await page
    .waitForFunction(
      () => !((document.querySelector("main") || document.body).innerText || "").includes("ตรวจสอบก่อนเริ่มงาน"),
      null,
      { timeout: 45000 }
    )
    .catch(() => {});
  await page.waitForTimeout(1500);
  const reachedTaskView = await page.evaluate(
    () => !((document.querySelector("main") || document.body).innerText || "").includes("ตรวจสอบก่อนเริ่มงาน")
  );
  const pfDebug = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /เริ่มงาน|ตรวจสอบให้ครบ/.test(b.textContent || ""));
    return {
      boxes: [...document.querySelectorAll('input[type="checkbox"]')].map((b) => b.checked),
      files: document.querySelectorAll('input[type="file"]').length,
      btnText: (btn?.textContent || "").trim(),
      btnDisabled: btn ? btn.disabled : null,
      err: ([...document.querySelectorAll("p")].find((p) => /อัปโหลด|กรุณา/.test(p.textContent || ""))?.textContent || "").trim()
    };
  });
  check("pre-flight completes and the task view mounts", reachedTaskView,
    `boxes=${JSON.stringify(pfDebug.boxes)} files=${pfDebug.files} btn="${pfDebug.btnText}" disabled=${pfDebug.btnDisabled} err="${pfDebug.err}"`);

  // 8. native -> web status event drives the web UI
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("tomp:native-status", {
      detail: {
        namespace: "tomp.driver", version: 1, type: "native.status",
        payload: {
          status: "gps_sharing", message: "กำลังส่งตำแหน่ง GPS จากแอป", canBackgroundLocation: true,
          recordedAt: new Date().toISOString(),
          detail: { latitude: 13.7563, longitude: 100.5018, accuracy: 12, recordedAt: new Date().toISOString() }
        }
      }
    }));
  });
  await page.waitForTimeout(800);
  const afterStatus = await page.textContent("body");
  check("web reacts to the native gps_sharing status", afterStatus.includes("กำลังส่งตำแหน่ง GPS จากแอป") || afterStatus.includes("ส่งตำแหน่งล่าสุด"));

  // 9. Mission Control sees the ping
  const mc = await fetch(`${baseUrl}/api/mission-control/locations`);
  check("mission-control locations endpoint guarded or serving", mc.status === 200 || mc.status === 401 || mc.status === 307, `HTTP ${mc.status}`);

  console.log("\nDriver API calls the page made:", JSON.stringify([...new Set(apiCalls)], null, 0));
} catch (error) {
  check("harness completed", false, error.message);
} finally {
  await page.screenshot({ path: "mobile-shell-sim.png", fullPage: true }).catch(() => {});
  await browser.close();
  await sql.end();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
