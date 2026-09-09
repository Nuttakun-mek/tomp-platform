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
  await expect(page.getByRole("heading", { name: /ไม่พบงาน/ })).toBeVisible();
});

test("api/health is honest", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.checks.publicSecretSafe).toBe(true);
});

// P0-2: the driver operational endpoints take project/assignment/driver from a
// signed session cookie, never a query string. With no cookie they must 401,
// not leak data.
const DRIVER_ENDPOINTS = [
  { method: "GET" as const, path: "/api/driver/updates" },
  { method: "POST" as const, path: "/api/driver/status" },
  { method: "POST" as const, path: "/api/driver/location" },
  { method: "POST" as const, path: "/api/driver/issue" },
  { method: "POST" as const, path: "/api/driver/readiness" }
];

for (const { method, path } of DRIVER_ENDPOINTS) {
  test(`${method} ${path} rejects a caller with no session (and ignores ?token=)`, async ({ request }) => {
    const noSession = method === "GET" ? await request.get(path) : await request.post(path, { data: {} });
    expect(noSession.status(), `${path} must reject an unauthenticated caller`).toBe(401);

    const url = `${path}?token=tomp_not_a_real_token`;
    const withToken = method === "GET" ? await request.get(url) : await request.post(url, { data: {} });
    expect(withToken.status(), `${path} must not honour a query-string token`).toBe(401);
  });
}
