# e2e — authenticated browser tests (957 Batch H)

These are the release-gate tests: `browser → API/action → database → Timeline`.
They are not wired into CI yet — that is the remaining Batch H work.

## Setup

```
npm i -D @playwright/test
npx playwright install chromium
```

## Run

```
# unauthenticated checks against production (safe, read-only)
E2E_BASE_URL=https://tomp-platform.vercel.app \
  npx playwright test --config e2e/playwright.config.ts unauthenticated

# full operator flow — needs a dedicated user and an isolated project prefix,
# so run it against a STAGING deployment, never production
E2E_BASE_URL=https://<staging> \
E2E_OPERATOR_EMAIL=pm1@tomp.test E2E_OPERATOR_PASSWORD=tomp-test-1234 \
E2E_PROJECT_PREFIX=E2E \
  npx playwright test --config e2e/playwright.config.ts operator-flow
```

`scripts/seed-test-users.mjs` creates `pm1@tomp.test` / `disp2@tomp.test`.

## Still to build

- Driver QR/PIN/readiness/GPS/status/message flow (needs a QR token minted
  by the operator flow, then a second browser context for the driver).
- Publish → lock → change-request flow.
- RBAC negative matrix (each forbidden command returns a failure).
- CI job: seed → run both projects → assert → `seed-test-users.mjs --reset`.
- The `db:verify-schema` / `db:verify-rls` / `db:load-scenario` scripts should
  run in the same CI pipeline against a disposable Postgres service.
