# Repository Audit: Thai UI Pilot

วันที่ตรวจ: 2026-06-29

## Thai UI Conversion Summary

Sprint 25-30 ปรับ application UI หลักจาก English prototype เป็น Thai-first internal pilot application โดยเน้น flow ที่ใช้งานจริง:

- ภาพรวม
- โครงการ
- ภารกิจ
- Assignment
- ทรัพยากร
- หน้าคนขับ
- Mission Control
- Publish baseline
- Change Request
- Pilot checklist

## Files Created

- `apps/web/lib/i18n/th.ts`
- `apps/web/lib/i18n/status-th.ts`
- `apps/web/app/pilot-checklist/page.tsx`
- `database/seed/0002_thai_pilot_scenario.sql`
- `docs/09-testing/906-thai-internal-pilot-scenario.md`
- `docs/05-ux/503-thai-ui-audit.md`
- `docs/11-codex/907-repository-audit-thai-ui-pilot.md`

## Functional Readiness

- Main navigation is Thai-first.
- Driver Card is mobile-first and uses Thai action labels.
- Mission Control uses Thai section names, Thai empty states, and Thai status badges.
- Project, Mission, Assignment, Driver, and Vehicle forms use Thai labels and messages.
- Demo/fallback data is labeled or rewritten as `ข้อมูลตัวอย่าง` where visible.
- Pilot checklist provides a guided end-to-end path.

## Pilot Readiness

Ready for guided internal pilot with operations staff and selected drivers.

Not ready for unsupervised production use.

## Remaining Production Gaps

- Auth/RBAC hardening with real users.
- RLS policy proof against real Supabase auth claims.
- Publish/change side-effect audit.
- Driver token expiry/revocation UX and security review.
- Supabase Storage bucket policy verification.
- Realtime Mission Control load and reconnect testing.
- End-to-end browser tests for Thai pilot scenario.

## Recommended Next Sprint

Sprint 31: Thai internal pilot hardening

Focus:

1. Run a supervised pilot with Thai operation manager, coordinator, and driver.
2. Capture UX feedback per role.
3. Convert remaining backend-origin error messages into Thai-friendly action results.
4. Add E2E smoke tests for the Thai pilot path.
5. Verify Supabase RLS, Storage, and Auth behavior with real users.
