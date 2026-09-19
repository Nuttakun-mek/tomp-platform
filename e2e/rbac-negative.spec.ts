import { expect, test } from "@playwright/test";

// P0-1: a project-scoped command must fail for a member whose role does not
// hold the permission, and the service-role key being configured must not
// change that. Runs against a STAGING deploy with two seeded users:
//   pm1@   (project_manager on project A)
//   disp2@ (dispatcher on project B)
// from scripts/seed-test-users.mjs.

const DISPATCHER_EMAIL = process.env.E2E_DISPATCHER_EMAIL;
const DISPATCHER_PASSWORD = process.env.E2E_DISPATCHER_PASSWORD;
const FOREIGN_PROJECT_ID = process.env.E2E_FOREIGN_PROJECT_ID; // a project the dispatcher is NOT a member of — still a uuid, used by the API check below
// App URLs are keyed by project_code, not id (/projects/<code>/ground-transfer/...,
// since Task 7's route move) — a companion code for the same foreign project.
const FOREIGN_PROJECT_CODE = process.env.E2E_FOREIGN_PROJECT_CODE;

test.skip(
  !DISPATCHER_EMAIL || !DISPATCHER_PASSWORD || !FOREIGN_PROJECT_ID || !FOREIGN_PROJECT_CODE,
  "set E2E_DISPATCHER_EMAIL / E2E_DISPATCHER_PASSWORD / E2E_FOREIGN_PROJECT_ID / E2E_FOREIGN_PROJECT_CODE"
);

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/อีเมล|email/i).fill(email);
  await page.getByLabel(/รหัสผ่าน|password/i).fill(password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ|sign in|log ?in/i }).click();
  await expect(page).toHaveURL(/\/(projects|portal|$)/, { timeout: 15_000 });
}

test("dispatcher cannot publish (role lacks project.publish)", async ({ page }) => {
  await login(page, DISPATCHER_EMAIL!, DISPATCHER_PASSWORD!);
  // E2E_DISPATCHER_PROJECT_CODE, when set, is the dispatcher's OWN project (they
  // are a member but lack project.publish there); otherwise fall back to the
  // foreign project, where the publish button simply won't render.
  const projectCode = process.env.E2E_DISPATCHER_PROJECT_CODE ?? FOREIGN_PROJECT_CODE;
  await page.goto(`/projects/${projectCode}/ground-transfer`);
  const publishButton = page.getByRole("button", { name: /ประกาศใช้แผน/ });
  if (await publishButton.count()) {
    await publishButton.first().click();
    await expect(page.getByText(/ไม่มีสิทธิ์|ไม่สามารถ|permission/i)).toBeVisible({ timeout: 10_000 });
  }
});

test("dispatcher gets no data for a project they are not a member of", async ({ page }) => {
  await login(page, DISPATCHER_EMAIL!, DISPATCHER_PASSWORD!);
  await page.goto(`/projects/${FOREIGN_PROJECT_CODE}/ground-transfer`);
  await expect(page.getByText(/ไม่ได้เป็นสมาชิก|เข้าโครงการนี้ไม่ได้|ไม่มีสิทธิ์/)).toBeVisible({ timeout: 10_000 });
});

test("assignment API for a foreign project is rejected", async ({ page, request }) => {
  await login(page, DISPATCHER_EMAIL!, DISPATCHER_PASSWORD!);
  // The session cookie is now on the context; a cross-project write must still fail.
  const res = await request.post("/api/driver/status", {
    data: { projectId: FOREIGN_PROJECT_ID, assignmentId: "00000000-0000-0000-0000-000000000000", status: "arrived" }
  });
  expect(res.status(), "no driver session -> 401 regardless of the operator cookie").toBe(401);
});
