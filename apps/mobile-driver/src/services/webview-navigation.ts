import { originOf, TOMP_WEB_ORIGIN } from "../config";

const EXTERNAL_ALLOWED_HOSTS = new Set(["www.google.com", "google.com", "maps.google.com"]);

export type NavigationDecision =
  | { action: "allow" }
  | { action: "external"; url: string }
  | { action: "block"; reason: string };

export function decideWebViewNavigation(rawUrl: string): NavigationDecision {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { action: "block", reason: "URL ไม่ถูกต้อง" };
  }

  if (originOf(rawUrl) === TOMP_WEB_ORIGIN) {
    if (url.pathname === "/driver" || url.pathname.startsWith("/driver/") || url.pathname.startsWith("/auth/")) {
      return { action: "allow" };
    }
    return { action: "external", url: rawUrl };
  }

  if (url.protocol === "tel:" || url.protocol === "mailto:") return { action: "external", url: rawUrl };
  if (url.protocol === "https:" && EXTERNAL_ALLOWED_HOSTS.has(url.hostname)) return { action: "external", url: rawUrl };
  if (url.protocol === "comgooglemaps:" || url.protocol === "geo:") return { action: "external", url: rawUrl };

  return { action: "block", reason: "แอปอนุญาตเฉพาะหน้า TOMP สำหรับคนขับและ Google Maps" };
}
