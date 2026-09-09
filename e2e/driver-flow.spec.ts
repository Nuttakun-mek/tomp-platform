import { expect, test } from "@playwright/test";

// P0-2 happy path: a driver opens a real QR link, enters the PIN, and the task
// view + operational calls work — but only through the signed session, and only
// from the bound device. Needs a QR token + PIN minted on a STAGING deploy
// (the operator flow prints one; or seed one and pass it here).

const QR_URL = process.env.E2E_DRIVER_QR_URL; // full https://<staging>/driver?token=tomp_...
const PIN = process.env.E2E_DRIVER_PIN; // 6 digits, if the token requires one

test.skip(!QR_URL, "set E2E_DRIVER_QR_URL (and E2E_DRIVER_PIN if the token has one)");

test("driver opens the QR link, enters PIN, and the task view loads", async ({ page }) => {
  await page.goto(QR_URL!);

  if (PIN) {
    for (const digit of PIN.split("")) {
      await page.getByRole("textbox").first().pressSequentially(digit, { delay: 20 }).catch(() => {});
    }
    await page.getByRole("button", { name: /ยืนยัน|เข้าใช้งาน|ต่อไป/ }).click().catch(() => {});
  }

  // The session gate resolves, then the job view renders (not an error notice).
  await expect(page.getByText(/กำลังเชื่อมต่องาน/)).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText(/งานของฉัน|สถานะงาน|แชร์ตำแหน่ง/)).toBeVisible({ timeout: 15_000 });
});

test("the driver session cookie makes /api/driver/updates return data", async ({ page, request }) => {
  await page.goto(QR_URL!);
  if (PIN) {
    for (const digit of PIN.split("")) {
      await page.getByRole("textbox").first().pressSequentially(digit, { delay: 20 }).catch(() => {});
    }
    await page.getByRole("button", { name: /ยืนยัน|เข้าใช้งาน|ต่อไป/ }).click().catch(() => {});
  }
  await expect(page.getByText(/กำลังเชื่อมต่องาน/)).toBeHidden({ timeout: 15_000 });

  const res = await request.get("/api/driver/updates");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("success", true);
});

test("a second browser (no cookie) still cannot read that driver's updates", async ({ browser }) => {
  const fresh = await browser.newContext();
  const res = await fresh.request.get("/api/driver/updates");
  expect(res.status()).toBe(401);
  await fresh.close();
});
