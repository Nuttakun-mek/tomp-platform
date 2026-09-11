# 969 - Bilingual i18n and Mobile Impact Plan

Date: 2026-09-11  
Status: implementation handoff, not a push/deploy approval  
Related notes: `967-call-sign-as-the-crewed-unit.md`, `968-dispatch-and-resources-rework.md`

## Current Result

TOMP remains Thai-first. This batch adds the first real bilingual foundation without changing the dispatch, QR, GPS, RBAC, database enum, or mobile session model.

Implemented now:

- Web locale primitives: `th`, `en`, locale normalization, dictionary lookup, request locale resolution, and date/status formatting helpers.
- Language switcher in the main app shell.
- Locale persistence through `tomp_locale` cookie.
- `?lang=th|en` support in middleware.
- Driver token redirect preserves `?lang=`.
- Navigation labels, descriptions, and tooltip text now resolve through i18n keys instead of hardcoded copy.
- Mobile driver shell has its own small locale dictionary and SecureStore-backed locale preference.
- Mobile driver links now include and preserve `?lang=th|en`.
- Tests cover locale normalization, navigation copy, status formatting, and mobile driver link locale handling.

Not fully implemented yet:

- Full page-by-page English translation for every dashboard, project, Mission Control, resource, and admin screen.
- Server action error localization by message code.
- User profile language preference stored in Supabase.
- Push notification template localization.

## Product Rules

- Thai is the default language.
- English is a display-layer option only.
- Do not translate database enums, API paths, permission keys, role keys, table names, or field names.
- Allowed English operational terms remain: TOMP, Call Sign, QR, GPS, Google Maps, Mission Control when paired with Thai context.
- Switching language must not create a timeline event because it is a user preference, not an operation event.
- Test tools remain grouped under system/admin tools and must not be mixed into the normal operating workflow.

## Locale Priority

1. URL query: `?lang=th|en`
2. Cookie: `tomp_locale`
3. Future profile preference
4. Default: `th`

## Web Architecture

Core files:

- `apps/web/lib/i18n/locales.ts`
- `apps/web/lib/i18n/th.ts`
- `apps/web/lib/i18n/en.ts`
- `apps/web/lib/i18n/index.ts`
- `apps/web/lib/i18n/server.ts`
- `apps/web/lib/i18n/format.ts`
- `apps/web/app/actions/locale.ts`
- `apps/web/components/i18n/language-switcher.tsx`

Navigation was refactored so RBAC remains independent from copy:

- `labelKey`
- `descriptionKey`
- `helpKey`

The app shell resolves those keys after the permission-filtered navigation model is built.

## Mobile Impact

Mobile changes that do not require a new native binary:

- Web driver page translation changes.
- Driver WebView URL changes when the app opens a token with `?lang=`.
- Server-side notification copy if the payload shape stays the same.

Mobile changes that do require a new build or EAS Update:

- Native shell copy such as QR scan, token paste, outbox, and GPS status labels.
- Native permission strings.
- Deep link scheme changes.
- Native package identifiers.
- Firebase/FCM native config changes.

Current mobile change is source-level only and should be included in the next Android/iOS build or EAS Update after device testing.

## QR and Dispatch Safety

The bilingual work must preserve these decisions from 967/968:

- QR belongs to the Call Sign crewed unit, not to each individual job.
- Creating/opening work on a unit must not re-add a mission dropdown. The unit already carries its mission.
- QR sheets should remain visible after collapse and light refresh within the same browser tab.
- A new QR should be issued only when the operator explicitly chooses to reissue it.

## Verification Checklist

- `npm install`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm --prefix apps/mobile-driver run typecheck`
- `npm --prefix apps/mobile-driver test`
- `NEXT_TELEMETRY_DISABLED=1 npm run build`
- Local smoke using `node scripts/start-local-check.mjs`
- Check `/login?lang=en`
- Check `/driver/<token>?lang=en` preserves language when redirected
- Check QR issue/collapse/reopen behavior on the assignment board
- Check tooltip positioning inside clipped cards

## Remaining Plan

1. Convert production pages to dictionary-based copy in small groups: dashboard, projects, assignments, Mission Control, resources, driver.
2. Add message-code based server action responses so UI can localize errors safely.
3. Add profile language preference after real account management stabilizes.
4. Add push notification template localization when notification workflow is finalized.
5. Run full physical-device mobile smoke before shipping a mobile binary.
