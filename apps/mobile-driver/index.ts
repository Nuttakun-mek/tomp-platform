import { registerRootComponent } from "expo";
import * as Sentry from "@sentry/react-native";

// Unset by default — this ships the plumbing only. Someone with a Sentry
// account sets EXPO_PUBLIC_SENTRY_DSN (see app.json's `extra` or an EAS
// secret) to turn it on; nothing here requires that to exist.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0.2 });
}

// Registering the background location task must happen before the root
// component, and before any UI module is evaluated. Android restores the task
// into a headless JS context after a reboot or a process kill; if the handler
// is not defined by the time it fires, the app dies on start.
import "./src/services/location";
import App from "./App";

registerRootComponent(App);
