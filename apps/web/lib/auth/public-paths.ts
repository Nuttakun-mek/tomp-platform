export const PUBLIC_PREFIXES = [
  "/login",
  "/no-access",
  // App Store Connect links to these as the app's privacy policy and support URL.
  "/privacy",
  "/support",
  "/auth/callback",
  "/ground-transfer/driver",
  "/helper",
  "/api/driver",
  "/api/health",
  "/ground-transfer/fleet",
  "/ground-transfer/track",
  "/_next",
  "/favicon.ico"
] as const;

export function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
