# TOMP Mobile Driver App Shell

This folder is a prepared shell for a future Driver App. The current production pilot remains `apps/web`.

Recommended future stack:

- React Native + Expo
- TypeScript
- Supabase
- Expo Location
- Expo Notifications
- Expo Camera
- SecureStore
- Background location when the driver grants permission and the operating system allows it

Future folder plan:

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

Initial driver app features to build later:

- QR login
- Assignment packet
- Today task
- GPS sharing
- Background location
- Photo evidence
- Status updates
- Route change acknowledgement
- Notifications
- Emergency contact
- Offline queue
- Resend failed events

Do not implement the full mobile app here yet. Reuse `@tomp/types`, `@tomp/driver-core`, and `@tomp/api-client` when development begins.
