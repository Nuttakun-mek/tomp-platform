# TOMP Flow Fixes, Capacity, and Mobile Driver Handoff

Date: 2026-09-09

## Implemented in this pass

- Added server action `createCallSignAction` so a dispatcher can create a Call Sign from the assignment form.
- Updated the assignment form to create/select a Call Sign without leaving the page.
- Added latest driver task status to driver access data and `/api/driver/updates`.
- Rebuilt the driver task view so progress survives refresh by reading the latest status from the database.
- Removed the fake GPS-live state. GPS is marked live only after a real location ping is successfully sent.
- Added a web driver outbox. Failed status, message, and issue actions are saved locally and retried when online or every 30 seconds.
- Added Postgres fallback for driver PIN verification so QR/PIN access still works when Supabase REST is unavailable but direct database access is configured.
- Added Postgres fallback for QR/PIN creation when Supabase REST writes are unavailable but direct database access is configured.
- Added a compact driver "งานวันนี้" list so the driver can see the current job and other same-day jobs in the same project.
- Added bulk QR/PIN generation for every assignment that already has Call Sign, driver, and vehicle.
- Rebuilt the Mission Control fleet board with compact per-vehicle cards, unread message badges, GPS freshness, and expandable vehicle/driver detail.

## Driver mobile app requirement

The driver experience must become a real iOS and Android mobile app. The web driver page remains useful for pilot testing, but it cannot guarantee background GPS after the driver switches apps or locks the screen.

Recommended pilot distribution without app stores:

- iOS: TestFlight or Apple Business Manager/internal distribution. iOS does not allow normal sideloading for broad users.
- Android: EAS internal build or signed APK shared directly to test devices.
- Stack: Expo + React Native + TypeScript, reusing `packages/driver-core`, shared types, and the existing driver API boundaries.

Mobile app must support:

- QR/PIN login.
- Assignment packet display.
- Background location with explicit consent.
- Status updates.
- Photo evidence.
- Messages and notifications.
- Offline queue and resend.
- Route-change acknowledgement.

The app copy must use formal, operational Thai. Avoid casual wording such as "ครับ" in system messages. Prefer concise enterprise language such as "ส่งข้อมูลสำเร็จ", "ไม่สามารถดำเนินการได้", and "โปรดตรวจสอบข้อมูล".

## Capacity note: 50 vehicles per day

The target load of about 50 vehicles per day with about 5 tasks per vehicle is approximately 250 assignment/task records per day. This is small for Supabase/Postgres and Vercel when the system uses the current intended architecture:

- Indexed assignment, driver, vehicle, project, status, and timestamp columns.
- Project-scoped reads.
- Realtime subscriptions limited to the active project, not every table globally.
- Polling or realtime throttled for driver updates.
- Pagination/filtering for operation boards.
- Location ping frequency controlled, for example every 10-30 seconds during pilot.

The larger risk is not raw transaction volume. The risk is operational correctness: wrong project scope, stale GPS, duplicated QR/token state, missing retry handling, and confusing UI feedback.

## Recommended next implementation focus

1. Add a real driver-day assignment list so one driver can see all jobs for today from one QR/PIN session.
2. Add recoverable/rotatable PIN without invalidating QR.
3. Add a dedicated vehicle detail slide-over with current task, remaining tasks, completed tasks, unread messages, and location health.
4. Add message unread indicators across the whole shell/header for control-room awareness.
5. Add tooltips to every operationally ambiguous action: Call Sign, QR, PIN, GPS, Publish, Timeline, RBAC, and Realtime.
6. Move duplicate live vehicle views out of Resources; Resources should be master data, Mission Control should own live operations.
7. Start the Expo Driver App pilot build path after web flow is stable.
8. Run a full visual QA pass for all pages: font scale, date/time controls, button size, card density, responsive behavior, and text overflow.
9. Add PDF/export QA for QR/PIN sheets after browser print is accepted by dispatch users.

## Verification scope for the next agent

- Create project.
- Create mission.
- Create assignment with no existing Call Sign by using the new Create Call Sign button.
- Create QR/PIN for that assignment.
- Use bulk QR/PIN generation for all ready assignments.
- Open `/driver?token=...`.
- Verify PIN screen appears.
- Enter PIN.
- Complete preflight.
- Start GPS sharing and confirm Mission Control sees the vehicle.
- Update status and refresh the driver page; status should not reset.
- Disable network, send a status/message, re-enable network, confirm outbox flush.

## Known remaining gaps

- Web background GPS is still best-effort only.
- Driver app is required for production-grade background location.
- Browser printable QR/PIN sheet exists, but PDF/export QA still needs human review.
- Message unread indicators in Mission Control need hardening.
- UI still needs a final enterprise spacing/typography pass across every page.
