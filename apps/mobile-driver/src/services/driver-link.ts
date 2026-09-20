import { buildDriverWebUrl, DRIVER_WEB_PATH_PREFIX, isDriverWebPath, originOf, TOMP_WEB_ORIGIN } from "../config";
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

function tokenFromCurrentDriverPath(pathname: string) {
  if (!isDriverWebPath(pathname)) return "";
  const prefixParts = DRIVER_WEB_PATH_PREFIX.split("/").filter(Boolean);
  const parts = pathname.split("/").filter(Boolean);
  return normalizeToken(parts[prefixParts.length] ?? "");
}

export function extractDriverToken(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!trimmed.includes("://") && !trimmed.includes("/")) return normalizeToken(trimmed);

  try {
    const url = new URL(trimmed);
    if (url.protocol === "tompdriver:") {
      const tokenParam = url.searchParams.get("token");
      return tokenParam ? normalizeToken(tokenParam) : "";
    }

    if (originOf(trimmed) !== TOMP_WEB_ORIGIN || !isDriverWebPath(url.pathname)) return "";

    const tokenParam = url.searchParams.get("token");
    if (tokenParam) return normalizeToken(tokenParam);
    return tokenFromCurrentDriverPath(url.pathname);
  } catch {
    return trimmed.includes("/") ? "" : normalizeToken(trimmed);
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
    return originOf(value) === TOMP_WEB_ORIGIN && isDriverWebPath(url.pathname);
  } catch {
    return false;
  }
}
