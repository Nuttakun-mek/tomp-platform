export const PUBLIC_PREFIXES = [
  "/login",
  "/no-access",
  "/auth/callback",
  "/driver",
  "/api/driver",
  "/api/health",
  "/fleet",
  "/track",
  "/_next",
  "/favicon.ico"
] as const;

export function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
