import { en } from "./en";
import { th } from "./th";
import type { LocaleCode } from "./locales";

export type I18nDictionary = {
  app: Record<string, string>;
  nav: {
    sections: Record<string, string>;
    projects: Record<string, string>;
    resources: Record<string, string>;
    portal: Record<string, string>;
    superadmin: Record<string, string>;
  };
  status: Record<string, string>;
};
export type I18nKey =
  | "app.productName"
  | "app.productDescription"
  | "app.workspaceLabel"
  | "app.menu"
  | "app.mainNav"
  | "app.language"
  | "app.thai"
  | "app.english"
  | "nav.sections.workspace"
  | "nav.sections.coordination"
  | "nav.sections.system"
  | "nav.projects.label"
  | "nav.projects.description"
  | "nav.projects.help"
  | "nav.resources.label"
  | "nav.resources.description"
  | "nav.resources.help"
  | "nav.portal.label"
  | "nav.portal.description"
  | "nav.portal.help"
  | "nav.superadmin.label"
  | "nav.superadmin.description"
  | "nav.superadmin.help";

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
  return typeof value === "string" ? value : key;
}
