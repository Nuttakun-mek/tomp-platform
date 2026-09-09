# 963 — P1-4: move Vercel to a native `apps/web` project root

Retires the legacy repo-root `vercel.json` (`builds` + `routes`), which bypasses
Next.js middleware and forces a hand-maintained rewrite per nested route. After
this, Vercel builds `apps/web` as a normal Next.js app: middleware runs, and
routing is the filesystem + `next.config.ts`.

## Why it is safe

Every `routes` entry in the current root `vercel.json` already has a native
equivalent in the repo:

| legacy route | native |
|---|---|
| `headers` on `/(.*)` | `apps/web/vercel.json` `headers` (this branch) |
| `/api/(.*)` → `/apps/web/api/$1` | native once the root is `apps/web` |
| `/admin/*`, `/live-test`, `/pilot-checklist` 307s | `next.config.ts` `redirects()` — already present, identical targets |
| `/projects/new` | real route `app/(app)/projects/new/page.tsx` |
| `/projects/:id`, `/projects/:id/assignments`, `/driver/:token`, `/resources/vehicles/:id` | redirect-shim routes that already exist (`…/[param]/page.tsx` → `?param=`) |
| catch-all `/(.*)` → `/apps/web/$1` | native once the root is `apps/web` |

The only behaviour change: the four shim routes **307-redirect** to the
query-string URL instead of transparently rewriting. QR / deep links still work
(one extra hop; the address bar shows `?token=` / `?projectId=`). If a
transparent URL is wanted later, delete the shim files and add `next.config.ts`
`rewrites()` — separate change.

## Sequence — do the steps close together

### 1. Repo — merge this branch (`p1-4-vercel-project-root`)

Adds `apps/web/vercel.json` (regions + security headers). **Inert** while the
Vercel Root Directory is still `./` — Vercel does not read an app-level
`vercel.json` until the root points at that directory. The repo-root
`vercel.json` keeps driving the current deploys. Zero risk to merge.

### 2. Vercel dashboard — flip the root (owner)

Settings → **Build and Deployment** → **Root Directory**:

- set it to `apps/web`, **Save**
- keep **"Include files outside of the root directory in the build step"** =
  Enabled (npm workspaces — `@tomp/types`, `@tomp/driver-core`, and the
  lockfile live at the repo root)
- **Framework Settings** above: **Save** so it re-detects Next.js (clears the
  "Production Overrides differ" warning)
- Deployments → latest → ⋯ → **Redeploy**

Vercel now builds from `apps/web`, reads `apps/web/vercel.json` +
`apps/web/next.config.ts`, and **ignores the repo-root `vercel.json`**.

### 3. Verify on the new deploy

- `node scripts/production-smoke.mjs` — all green
- headers present: `curl -sI https://tomp-platform.vercel.app/ | grep -iE "strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy"`
- `/admin` → 307 `/superadmin`; `/live-test` → 307
- `/projects/<real-id>` → lands on the project overview (via the 307 shim)
- `/driver/<token>` from a real QR → the driver flow opens
- `/resources/vehicles/<id>` → the vehicle profile
- middleware runs (auth redirects still send anon → `/login`)
- `e2e/unauthenticated.spec.ts` against production — 15/15

### 4. Repo cleanup — after step 3 passes

Delete the repo-root `vercel.json` (a follow-up PR). Once the Root Directory is
`apps/web`, Vercel no longer reads it, so removing it only tidies the repo. If
anything in step 3 failed, revert the Root Directory to empty in the dashboard
and redeploy — the root `vercel.json` takes over again immediately.

## Rollback

Dashboard → Root Directory → clear it → Save → Redeploy. The repo-root
`vercel.json` is authoritative again. No repo revert needed (the app-level
`vercel.json` goes inert on its own).
