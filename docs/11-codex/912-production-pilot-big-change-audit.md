# Production Pilot Big Change Audit

## What Changed

- Added Admin Production Pilot Smoke Test page.
- Added server actions to check Supabase infrastructure and create a real pilot scenario with unique IDs.
- Updated `/live-test` to use the same real scenario generator.
- Cleaned Thai copy for admin and live-test pages.
- Added explicit Supabase grants migration for driver operation tables.
- Added production smoke test documentation.

## Ready Now

- Internal admin can verify core tables from the UI.
- Internal admin can create a real Project/Mission/Assignment/QR/Packet/Notification/Route Change test set.
- Driver link can be opened immediately after generation.
- Mission Control link opens scoped to the generated project.

## Still Needs Human Verification

- Apply migrations to production Supabase.
- Run `/admin/pilot-smoke-test` on production.
- Test mobile GPS on real iOS/Android devices.
- Confirm Mission Control map renders latest location.

## Risk

- If Supabase project has Data API grants disabled for new tables, migration `0012` must be applied before the smoke test can pass.
- The admin smoke page is an internal pilot tool and should later be protected by real admin RBAC.

## Next Recommended Sprint

Sprint 34: Real Auth + Admin RBAC guard for smoke-test tools and operation pages.
