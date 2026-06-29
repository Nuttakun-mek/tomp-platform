# Repository Audit: Thai UI Pilot

วันที่ตรวจ: 2026-06-30

## What Changed

รอบนี้เป็น UI/UX hardening สำหรับ Thai-first internal pilot โดยไม่เพิ่ม business scope ใหม่

Completed:

- Clean Thai navigation and app shell
- Polished dashboard
- Mobile-first Driver Card and driver actions
- Mission Control redesign for operations staff
- Project, Mission, and Assignment forms grouped and Thai-first
- Shared UI components polished
- Thai server action messages for primary create flows
- README and verification docs refreshed

## Files Created Earlier And Kept

- `apps/web/lib/i18n/th.ts`
- `apps/web/lib/i18n/status-th.ts`
- `apps/web/app/pilot-checklist/page.tsx`
- `database/seed/0002_thai_pilot_scenario.sql`
- `docs/09-testing/906-thai-internal-pilot-scenario.md`
- `docs/05-ux/503-thai-ui-audit.md`
- `docs/11-codex/907-repository-audit-thai-ui-pilot.md`

## Functional Readiness

- Main UI is Thai-first.
- Driver UI is mobile-first with large buttons and persistent contact actions.
- Mission Control is visually clearer for desktop/tablet operations use.
- Project/Mission/Assignment forms are more usable and less prototype-like.
- Demo/fallback data is labeled as `ข้อมูลตัวอย่าง` where visible.

## Not Production Ready

- Auth/RBAC hardening with real users
- RLS proof against real Supabase Auth claims
- Driver token revoke/expiry UX
- Supabase Storage policy verification
- Realtime Mission Control load testing
- E2E browser testing for the Thai pilot path

## Recommended Next Sprint

Sprint 31: Thai internal pilot hardening

Focus:

1. Run guided pilot with operation manager, coordinator, and driver.
2. Capture UX feedback by role.
3. Convert remaining backend-origin database errors to Thai action messages.
4. Add Playwright smoke tests for the Thai pilot flow.
5. Verify Supabase RLS, Auth, Storage, and Realtime with real users.
