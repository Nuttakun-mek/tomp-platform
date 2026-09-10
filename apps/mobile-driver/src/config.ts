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
export const LOCATION_TASK_NAME = "tomp-driver-background-location";

export function buildDriverWebUrl(token: string) {
  return `${TOMP_WEB_ORIGIN}/driver/${encodeURIComponent(token)}`;
}
