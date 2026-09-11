import { en } from "./en";
import { th } from "./th";
import type { DictionaryShape, I18nKey } from "./keys";
import type { LocaleCode } from "./locales";

export type { I18nKey } from "./keys";
export type I18nDictionary = DictionaryShape<typeof th>;

const dictionaries: Record<LocaleCode, I18nDictionary> = { th, en };

export function getDictionary(locale: LocaleCode): I18nDictionary {
  return dictionaries[locale] ?? dictionaries.th;
}

export function t(locale: LocaleCode, key: I18nKey): string {
  const dict = getDictionary(locale) as unknown as Record<string, unknown>;
  const value = key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, dict);
  if (typeof value === "string") return value;
  return process.env.NODE_ENV === "production" ? key : `⟦${key}⟧`;
}
