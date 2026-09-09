import { defineConfig, devices } from "@playwright/test";

// 957 Batch H — authenticated browser → API/action → database E2E.
// Requires `npm i -D @playwright/test` and `npx playwright install chromium`.
//
//   E2E_BASE_URL=https://tomp-platform.vercel.app npx playwright test --config e2e/playwright.config.ts
//
// The operator flow is skipped until a seeded test user exists — set
// E2E_OPERATOR_EMAIL / E2E_OPERATOR_PASSWORD (see scripts/seed-test-users.mjs)
// and an isolated project code prefix E2E_PROJECT_PREFIX to enable it.

export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
