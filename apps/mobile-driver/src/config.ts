export const TOMP_API_BASE_URL =
  process.env.EXPO_PUBLIC_TOMP_API_BASE_URL ||
  "https://tomp-platform.vercel.app";

// React Native's URL polyfill does not implement every WHATWG getter — `origin`
// in particular throws on some engines. This runs at module scope, so a throw
// here kills the app before it renders and the dev client just reloads forever.
// Parse the origin off the string instead; it never throws.
export function originOf(rawUrl: string): string {
  const match = /^([a-z][a-z0-9+.-]*:)\/\/([^/?#]+)/i.exec(rawUrl.trim());
  return match ? `${match[1].toLowerCase()}//${match[2].toLowerCase()}` : "";
}

export const TOMP_WEB_ORIGIN = originOf(TOMP_API_BASE_URL);
export const TOMP_DRIVER_APP_VERSION = "0.2.0";

// Background GPS needs RECEIVE_BOOT_COMPLETED in the manifest: expo-task-manager
// schedules a *persisted* JobScheduler job to deliver locations, and Android
// throws IllegalArgumentException on the main thread without that permission —
// which killed the app the moment the first background fix arrived. Added to
// app.json; set EXPO_PUBLIC_TOMP_ENABLE_BACKGROUND_GPS=0 to disable again.
export const BACKGROUND_GPS_ENABLED = process.env.EXPO_PUBLIC_TOMP_ENABLE_BACKGROUND_GPS !== "0";
export const LOCATION_TASK_NAME = "tomp-driver-background-location";

// getExpoPushTokenAsync needs the EAS project id in a bare/dev-client build.
// Mirrors expo.extra.eas.projectId in app.json.
export const EAS_PROJECT_ID = "ea9c91b8-049d-4287-bfcd-dad4ecc7981b";

export type DriverWebViewKey = "home" | "next" | "messages" | "gps";

export function buildDriverWebUrl(token: string, locale: "th" | "en" = "th", view: DriverWebViewKey = "home") {
  return `${TOMP_WEB_ORIGIN}/driver/${encodeURIComponent(token)}?lang=${locale}&view=${encodeURIComponent(view)}`;
}
