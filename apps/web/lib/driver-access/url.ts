function getFallbackBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}

export function buildDriverAccessUrl(token: string, baseUrl = getFallbackBaseUrl()): string {
  return `${baseUrl.replace(/\/$/, "")}/driver?token=${encodeURIComponent(token)}`;
}
