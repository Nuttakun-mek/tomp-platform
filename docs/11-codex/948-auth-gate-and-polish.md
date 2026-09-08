# Auth gate + version stamp + sidebar consistency (post-Phase-L)

Commit `8880572`.

## SECURITY — anonymous access to the workspace

`/projects`, `/mission-control`, `/assignments` etc. rendered for **unauthenticated**
visitors: the project list showed, and `/mission-control` redirected to
`/mission-control?projectId=<real uuid>` — leaking a live project id.

**Cause:** the legacy `vercel.json` `builds`+`routes` config bypasses the Next.js
middleware on production (the `routes` array is the whole routing table; the
middleware is never wired in). `middleware.ts`'s auth redirect therefore never ran.
Pages fall back to the service-role read client when there's no session, so data
was reachable too.

**Fix (defense in depth, no middleware needed):**
- `app/(app)/layout.tsx` is now `async` — `getCurrentUserProfile()`; if not signed
  in → `redirect('/login')`. One gate for the entire authenticated route group.
- `mission-control/page.tsx` + `assignments/page.tsx`: explicit
  `getCurrentUserProfile` check at the very top, **before** `getProjects()`, so a
  render race can't leak a project id in the redirect.
- `login/page.tsx`: signed-in visitors bounce to `/projects`.

Middleware still exists for local dev / any future non-legacy deploy.

## Version badge shows date + time

`next.config.ts` bakes `NEXT_PUBLIC_BUILD_TIME` (`new Date().toISOString()` at build)
and `NEXT_PUBLIC_BUILD_SHA` (`VERCEL_GIT_COMMIT_SHA`). `<BuildVersionBadge>` renders
"อัปเดตล่าสุด &lt;dd/mm/yyyy hh:mm&gt; น." in Asia/Bangkok — always the real deploy
moment, replacing the stale hand-edited `lib/build-info.ts` string.

## Sidebar looked different per page

The `<aside>` used `command-panel-dark` (26 px radius + glow — a *floating hero*
style). On pages with a dark hero (`/resources`, `/mission-control`) it merged with
that hero; on all-light pages it sat alone with a rounded dark edge. →
**square edges on the sidebar** (`style={{ borderRadius: 0 }}` + `rounded-none`),
and `<CommandCenterHeader>` normalised from `rounded-[28px]` to
`rounded-panel` / `shadow-command` to match `enterprise-panel`.

## Verify
typecheck 0 · lint 0 · web 54/15 · driver-core 14/5 · build 0 · deploy probe:
`/projects` unauthenticated → 307 `/login`.
