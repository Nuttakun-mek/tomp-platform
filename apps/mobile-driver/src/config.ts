export const TOMP_API_BASE_URL =
  process.env.EXPO_PUBLIC_TOMP_API_BASE_URL ||
  "https://tomp-platform.vercel.app";

export const TOMP_WEB_ORIGIN = new URL(TOMP_API_BASE_URL).origin;
export const TOMP_DRIVER_APP_VERSION = "0.2.0";
export const LOCATION_TASK_NAME = "tomp-driver-background-location";

export function buildDriverWebUrl(token: string) {
  return `${TOMP_WEB_ORIGIN}/driver/${encodeURIComponent(token)}`;
}
