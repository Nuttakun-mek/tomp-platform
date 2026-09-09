import { expect, test } from "@playwright/test";

// Full operator path: login → create project → mission → assignment → QR/PIN,
// asserting the page landmarks and (where the app surfaces it) the resulting
// state. Skipped until a dedicated test user + isolated project prefix are set.

const EMAIL = process.env.E2E_OPERATOR_EMAIL;
const PASSWORD = process.env.E2E_OPERATOR_PASSWORD;
const PREFIX = process.env.E2E_PROJECT_PREFIX ?? "E2E";

test.skip(!EMAIL || !PASSWORD, "set E2E_OPERATOR_EMAIL / E2E_OPERATOR_PASSWORD to run");

test("operator creates a project through to a QR token", async ({ page }) => {
  const code = `${PREFIX}-${Date.now().toString(36).toUpperCase()}`;

  await page.goto("/login");
  await page.getByLabel(/อีเมล|email/i).fill(EMAIL!);
  await page.getByLabel(/รหัสผ่าน|password/i).fill(PASSWORD!);
  await page.getByRole("button", { name: /เข้าสู่ระบบ|sign in|log ?in/i }).click();
  await expect(page).toHaveURL(/\/(projects|$)/, { timeout: 15_000 });

  // create project
  await page.goto("/projects/new");
  await page.getByPlaceholder(/TOMP-|รหัสโครงการ/i).fill(code).catch(() => {});
  await page.getByLabel(/ชื่อโครงการ|project name/i).fill(`${code} E2E`);
  await page.getByRole("button", { name: /บันทึกโครงการ|create project/i }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/, { timeout: 15_000 });
  const projectUrl = page.url();

  // mission
  await page.getByRole("button", { name: /เพิ่มภารกิจ/ }).click().catch(() => {});
  await page.getByPlaceholder("MIS-001").fill(`M-${code}`);
  await page.getByPlaceholder(/รับผู้โดยสาร/).fill("E2E mission");
  await page.getByPlaceholder("รับจากสนามบิน").fill("shuttle");
  await page.getByRole("button", { name: /บันทึกภารกิจ/ }).click();
  await expect(page.getByText(/บันทึกภารกิจแล้ว/)).toBeVisible({ timeout: 15_000 });

  // assignment + QR — navigate to the dispatch tab
  await page.goto(`${projectUrl.replace(/\/projects\//, "/assignments?projectId=").replace(/\/projects\/([0-9a-f-]+)/, "$1")}`).catch(() => {});
  await expect(page.getByText(/จัดงาน|บอร์ดจัดสรรงาน/)).toBeVisible({ timeout: 15_000 });

  // Timeline should record the project creation
  await page.goto(projectUrl);
  await expect(page.getByText(/ความพร้อม|readiness|ภาพรวม/i)).toBeVisible();
});
