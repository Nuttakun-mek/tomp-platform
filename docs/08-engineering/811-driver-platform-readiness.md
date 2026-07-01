# Driver Platform Readiness

## Why Web Remains Primary

The Web App is deployable now, supports operations users, supports QR driver access, and is the lowest-cost pilot path. It is suitable for foreground GPS testing and internal workflow validation.

## Why Mobile Driver App Is Prepared But Not Built

Reliable background GPS, camera/photo evidence, push notification handling, offline queueing, and secure token storage are stronger in a native mobile runtime. Building that before the pilot workflow is validated would add cost and risk.

## Shared Driver Capabilities

- Assignment packet delivery.
- Driver task status lifecycle.
- Route instruction and route change messaging.
- GPS ping/session/health contracts.
- Driver notification and acknowledgement model.
- Contact and escalation model.
- Evidence/photo contracts.

## Future React Native / Expo Path

Use Expo Location, Expo Notifications, Expo Camera, SecureStore, and a small offline queue. Keep all operational language and business rules aligned with `@tomp/driver-core`.

## Do Not Duplicate

Do not reimplement driver status labels, route summaries, notification escalation, or GPS health evaluation separately in mobile.
