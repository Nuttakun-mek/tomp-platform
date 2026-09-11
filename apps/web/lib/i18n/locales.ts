export const LOCALES = ["th", "en"] as const;
export type LocaleCode = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: LocaleCode = "th";
export const LOCALE_COOKIE = "tomp_locale";

export function isLocale(value: unknown): value is LocaleCode {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: unknown): LocaleCode {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
