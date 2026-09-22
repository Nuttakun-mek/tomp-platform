import { expect, test } from "@playwright/test";

const driverUrl = process.env.E2E_DRIVER_QR_URL;
const driverPin = process.env.E2E_DRIVER_PIN;
const fleetUrl = process.env.E2E_FLEET_URL;
const missionControlUrl = process.env.E2E_MISSION_CONTROL_URL;

async function unlockDriverPin(page: import("@playwright/test").Page) {
  if (!driverPin) return;
  const input = page.locator('input[inputmode="numeric"], input[name*="pin" i], input[type="tel"]').first();
  if (!(await input.count())) return;
  await input.fill(driverPin);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForLoadState("networkidle").catch(() => {});
}

test.describe("mobile visual regression", () => {
  test.skip(!process.env.E2E_VISUAL, "Set E2E_VISUAL=1 and provide URLs to run visual checks.");

  test("driver mobile shell first screen fits the device", async ({ page }) => {
    test.skip(!driverUrl, "E2E_DRIVER_QR_URL is required.");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(driverUrl!, { waitUntil: "domcontentloaded" });
    await unlockDriverPin(page);
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveScreenshot("driver-mobile-shell.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.03
    });
  });

  test("fleet public view keeps cards and QR content within the viewport", async ({ page }) => {
    test.skip(!fleetUrl, "E2E_FLEET_URL is required.");
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(fleetUrl!, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveScreenshot("fleet-public-view.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.03
    });
  });

  test("mission control driver card layout is visually stable", async ({ page }) => {
    test.skip(!missionControlUrl, "E2E_MISSION_CONTROL_URL is required and must already be authenticated.");
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(missionControlUrl!, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveScreenshot("mission-control-driver-cards.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.03
    });
  });
});
