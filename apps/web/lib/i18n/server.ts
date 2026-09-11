import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale, type LocaleCode } from "./locales";

export async function getRequestLocale(): Promise<LocaleCode> {
  const headerStore = await headers();
  const headerLocale = normalizeLocale(headerStore.get("x-tomp-locale"));
  if (headerLocale !== DEFAULT_LOCALE || headerStore.has("x-tomp-locale")) return headerLocale;

  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE);
}
