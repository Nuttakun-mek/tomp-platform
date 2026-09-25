function getFallbackBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}

// Named, not positional: both arguments are strings, and the Apple review demo
// once passed them the other way round — the reviewer's link came out as
// "<token>/ground-transfer/driver?token=https%3A%2F%2F…".
export function buildDriverAccessUrl({ token, baseUrl = getFallbackBaseUrl() }: { token: string; baseUrl?: string }): string {
  return `${baseUrl.replace(/\/$/, "")}/ground-transfer/driver?token=${encodeURIComponent(token)}`;
}
