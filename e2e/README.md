# e2e — authenticated browser tests (957 Batch H)

These are the release-gate tests: `browser → API/action → database → Timeline`.

## Setup

```
npm i -D @playwright/test          # already in the root devDependencies
npx playwright install chromium
```

## Specs

| file | needs | in CI |
|---|---|---|
| `unauthenticated.spec.ts` | nothing (read-only vs prod) | ✅ `e2e-unauthenticated` job |
| `operator-flow.spec.ts` | `E2E_OPERATOR_EMAIL` / `_PASSWORD`, staging | no — staging only |
| `driver-flow.spec.ts` | `E2E_DRIVER_QR_URL` (+ `E2E_DRIVER_PIN`), staging | no — staging only |
| `rbac-negative.spec.ts` | `E2E_DISPATCHER_EMAIL` / `_PASSWORD` / `E2E_FOREIGN_PROJECT_ID`, staging | no — staging only |

`unauthenticated.spec.ts` also covers P0-2 directly: every `/api/driver/*`
operational endpoint must return 401 with no session cookie and must ignore a
`?token=` query string.

## Run

```
# unauthenticated checks against production (safe, read-only) — same as CI
E2E_BASE_URL=https://tomp-platform.vercel.app \
  npx playwright test --config e2e/playwright.config.ts unauthenticated

# full operator flow — needs a dedicated user and an isolated project prefix,
# so run it against a STAGING deployment, never production
E2E_BASE_URL=https://<staging> \
E2E_OPERATOR_EMAIL=pm1@tomp.test E2E_OPERATOR_PASSWORD=tomp-test-1234 \
E2E_PROJECT_PREFIX=E2E \
  npx playwright test --config e2e/playwright.config.ts operator-flow

# driver flow — mint a QR token on staging first (operator flow prints one)
E2E_BASE_URL=https://<staging> \
E2E_DRIVER_QR_URL="https://<staging>/driver?token=tomp_..." E2E_DRIVER_PIN=123456 \
  npx playwright test --config e2e/playwright.config.ts driver-flow

# rbac negative — two seeded users on two projects
E2E_BASE_URL=https://<staging> \
E2E_DISPATCHER_EMAIL=disp2@tomp.test E2E_DISPATCHER_PASSWORD=tomp-test-1234 \
E2E_FOREIGN_PROJECT_ID=<uuid of a project disp2 is not on> \
  npx playwright test --config e2e/playwright.config.ts rbac-negative
```

`scripts/seed-test-users.mjs` creates `pm1@tomp.test` / `disp2@tomp.test`.

## CI

`.github/workflows/ci.yml`:

- **`database`** — Postgres 17 service; `db:verify-schema`, `db:verify-rls`,
  `db:load-scenario` against it.
`.github/workflows/e2e-prod.yml` — `unauthenticated.spec.ts` against production
on a 3-hour schedule + `workflow_dispatch` (not on push: a push races the Vercel
deploy).

## Still to build

- Wire the staging specs (operator / driver / rbac-negative) into a scheduled CI
  job that seeds → runs → `seed-test-users.mjs --reset`, once a staging deploy
  with its own Supabase project exists.
- Publish → lock → change-request flow spec.
