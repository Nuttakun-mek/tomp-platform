# Future Mobile Driver App Plan

## Recommended Stack

- React Native + Expo
- TypeScript
- Supabase
- Expo Location
- Expo Notifications
- Expo Camera
- SecureStore
- Background location when allowed by device settings

## Core Features

- QR login.
- Assignment packet.
- Today task.
- GPS sharing.
- Background location.
- Photo evidence.
- Status updates.
- Route change acknowledgement.
- Notifications.
- Emergency contact.
- Offline queue.
- Resend failed events.

## Folder Plan

```text
apps/mobile-driver/
  app/
  src/
    screens/
    components/
    services/
    location/
    notifications/
    storage/
    offline/
```

## Reuse Required

The future app must consume:

- `@tomp/types`
- `@tomp/driver-core`
- `@tomp/api-client`

Do not duplicate driver workflow logic inside the mobile app.
