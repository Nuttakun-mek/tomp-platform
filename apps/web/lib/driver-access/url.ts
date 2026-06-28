export function buildDriverAccessUrl(token: string, baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"): string {
  return `${baseUrl.replace(/\/$/, "")}/driver/${encodeURIComponent(token)}`;
}
