import { expect, test } from "@playwright/test";

// The half of the release gate that needs no session: an anonymous browser must
// never reach protected data, and the public pages must actually serve.

const PROTECTED = ["/", "/projects", "/mission-control", "/assignments", "/recovery", "/superadmin", "/resources"];

for (const path of PROTECTED) {
  test(`anonymous ${path} redirects to /login`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${path} should not 5xx`).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });
}

test("login page renders its form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /เข้าสู่ระบบ|sign in|log ?in/i })).toBeVisible();
});

test("driver entry with no token shows the 'no job' notice, not an error", async ({ page }) => {
  const response = await page.goto("/driver");
  expect(response?.status()).toBe(200);
  await expect(page.getByText(/ไม่พบงาน|ลิงก์.*หมดอายุ/)).toBeVisible();
});

test("api/health is honest", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.checks.publicSecretSafe).toBe(true);
});
