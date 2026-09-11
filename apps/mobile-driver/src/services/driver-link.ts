import { buildDriverWebUrl, originOf, TOMP_WEB_ORIGIN } from "../config";
import { normalizeMobileLocale, type MobileLocale } from "../i18n";

export interface DriverLinkParseResult {
  token: string;
  webUrl: string;
  locale: MobileLocale;
  source: "raw-token" | "web-url" | "deep-link";
}

function normalizeToken(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

export function extractDriverToken(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!trimmed.includes("://") && !trimmed.includes("/")) return normalizeToken(trimmed);

  try {
    const url = new URL(trimmed);
    const tokenParam = url.searchParams.get("token");
    if (tokenParam) return normalizeToken(tokenParam);

    const parts = url.pathname.split("/").filter(Boolean);
    const driverIndex = parts.findIndex((part) => part === "driver");
    if (driverIndex >= 0 && parts[driverIndex + 1]) return normalizeToken(parts[driverIndex + 1]);
    return normalizeToken(parts[parts.length - 1] ?? "");
  } catch {
    return normalizeToken(trimmed);
  }
}

export function parseDriverLink(value: string, fallbackLocale: MobileLocale = "th"): DriverLinkParseResult | null {
  const token = extractDriverToken(value);
  if (!token) return null;

  let source: DriverLinkParseResult["source"] = "raw-token";
  let locale: MobileLocale = fallbackLocale;
  try {
    const url = new URL(value.trim());
    source = url.protocol === "tompdriver:" ? "deep-link" : "web-url";
    locale = normalizeMobileLocale(url.searchParams.get("lang"));
  } catch {
    source = "raw-token";
  }

  return {
    token,
    webUrl: buildDriverWebUrl(token, locale),
    locale,
    source
  };
}

export function isTompDriverWebUrl(value: string) {
  try {
    const url = new URL(value);
    return originOf(value) === TOMP_WEB_ORIGIN && (url.pathname === "/driver" || url.pathname.startsWith("/driver/"));
  } catch {
    return false;
  }
}
