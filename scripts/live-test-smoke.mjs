#!/usr/bin/env node
// Drives the /live-test page end to end with a real browser:
//   check infrastructure -> create Project/Mission/Assignment -> render QR.
// Prints the driver access URL and saves the QR PNG.
//
// Usage: node scripts/live-test-smoke.mjs [baseUrl]
//   baseUrl defaults to http://localhost:3000
//   Pass a LAN URL (http://<lan-ip>:3000) so the generated QR is reachable
//   from a phone on the same network.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p));
}

function lanUrl(port) {
  for (const nics of Object.values(os.networkInterfaces())) {
    for (const nic of nics || []) {
      if (nic.family === "IPv4" && !nic.internal) return `http://${nic.address}:${port}`;
    }
  }
  return `http://localhost:${port}`;
}

const baseUrl = process.argv[2] || "http://localhost:3000";
const lanBase = lanUrl(3000);
const chromePath = findChrome();
if (!chromePath) {
  console.error("ERROR: no Chrome/Edge binary found. Set CHROME_PATH.");
  process.exit(1);
}

console.log(`Browser : ${chromePath}`);
console.log(`Target  : ${baseUrl}/live-test\n`);

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});

let exitCode = 0;
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log(`  [browser error] ${msg.text()}`);
  });

  await page.goto(`${baseUrl}/live-test`, { waitUntil: "networkidle2" });

  const startButton = await page.waitForSelector("button::-p-text(เริ่มทดสอบระบบ)", { timeout: 20000 });
  // Give React a moment to hydrate before clicking.
  await new Promise((r) => setTimeout(r, 1500));
  console.log("Clicking 'เริ่มทดสอบระบบ' ...");
  await startButton.click();

  // Wait until either the QR result URL appears or a terminal status message.
  let lastMsg = "";
  await page.waitForFunction(
    () => {
      const link = document.querySelector('a[href*="/driver?token="]');
      if (link) return true;
      const msg = document.body.innerText;
      return /ไม่สำเร็จ|ไม่พร้อม|เกินกำหนด|ตรวจระบบไม่สำเร็จ/.test(msg);
    },
    { timeout: 120000, polling: 1000 }
  ).catch(async () => {
    lastMsg = await page.evaluate(() => document.body.innerText.slice(0, 1200));
    throw new Error(`timed out waiting for result. Page text:\n${lastMsg}`);
  });

  const result = await page.evaluate(() => {
    const link = document.querySelector('a[href*="/driver?token="]');
    const text = document.body.innerText;
    const grab = (re) => (text.match(re)?.[1] ?? null);
    const img = document.querySelector('img[alt="QR สำหรับคนขับ"]');
    return {
      accessUrl: link?.getAttribute("href") ?? null,
      projectId: grab(/Project ID:\s*([0-9a-f-]{36})/i),
      assignmentId: grab(/Assignment ID:\s*([0-9a-f-]{36})/i),
      driverId: grab(/Driver ID:\s*([0-9a-f-]{36})/i),
      packetId: grab(/Packet ID:\s*([0-9a-f-]{36})/i),
      qr: img?.getAttribute("src") ?? null,
      statusMessage: (text.match(/(สร้างชุดทดสอบสำเร็จ[^\n]*|[^\n]*ไม่สำเร็จ[^\n]*|[^\n]*ไม่พร้อม[^\n]*|[^\n]*เกินกำหนด[^\n]*)/) || [])[1] || null
    };
  });

  if (!result.accessUrl) {
    exitCode = 1;
    console.log(`\nFAILED: ${result.statusMessage || "no access URL produced"}`);
    const shot = path.join(ROOT, "scripts", "live-test-failure.png");
    await page.screenshot({ path: shot, fullPage: true });
    console.log(`Screenshot: ${shot}`);
  } else {
    console.log("\n=== live-test scenario created ===");
    console.log(`access URL   : ${result.accessUrl}`);
    console.log(`project      : ${result.projectId}`);
    console.log(`assignment   : ${result.assignmentId}`);
    console.log(`driver       : ${result.driverId}`);
    console.log(`packet       : ${result.packetId}`);
    console.log(`status       : ${result.statusMessage}`);
    if (result.qr?.startsWith("data:image/")) {
      const b64 = result.qr.split(",")[1];
      const out = path.join(ROOT, "scripts", "live-test-qr.png");
      fs.writeFileSync(out, Buffer.from(b64, "base64"));
      console.log(`QR PNG       : ${out}`);
    }
    if (result.accessUrl && !result.accessUrl.includes(lanBase.replace(/^http:\/\//, ""))) {
      const phoneUrl = result.accessUrl.replace(/^https?:\/\/[^/]+/, lanBase);
      console.log(`\nphone URL    : ${phoneUrl}`);
      console.log("  (same token, host swapped to this machine's LAN IP so a phone on the same WiFi can open it)");
    }
  }
} catch (error) {
  exitCode = 1;
  console.error(`\nERROR: ${error?.message || error}`);
} finally {
  await browser.close();
}
process.exit(exitCode);
