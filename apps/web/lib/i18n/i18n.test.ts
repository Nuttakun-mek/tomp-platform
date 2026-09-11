import { describe, expect, it } from "vitest";
import { t, type I18nKey } from "./index";
import { normalizeLocale } from "./locales";
import { formatStatus } from "./format";
import { th } from "./th";
import { en } from "./en";

describe("i18n", () => {
  it("normalizes unsupported locales to Thai", () => {
    expect(normalizeLocale("en")).toBe("en");
    expect(normalizeLocale("th")).toBe("th");
    expect(normalizeLocale("fr")).toBe("th");
  });

  it("translates stable keys without touching permission or route values", () => {
    expect(t("th", "nav.projects.label")).toBe("โครงการ");
    expect(t("en", "nav.projects.label")).toBe("Projects");
    expect(t("en", "nav.superadmin.description")).toContain("permissions");
  });

  it("formats display statuses while keeping canonical status keys external", () => {
    expect(formatStatus("ready", "th")).toBe("พร้อม");
    expect(formatStatus("ready", "en")).toBe("Ready");
    expect(formatStatus("needs_review", "en")).toBe("needs review");
  });
});

describe("the two dictionaries stay in step", () => {
  // The failure this guards is silent: translating a new page means adding keys
  // to th.ts, and forgetting en.ts leaves an English reader looking at a raw key
  // or at Thai. Nothing on screen says which happened, so it gets found by a
  // customer rather than by us.
  const paths = (value: unknown, prefix = ""): I18nKey[] => {
    if (typeof value !== "object" || value === null) return [prefix as I18nKey];
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      paths(child, prefix ? `${prefix}.${key}` : key)
    );
  };

  it("has the same keys on both sides", () => {
    const thaiKeys = paths(th).sort();
    const englishKeys = paths(en).sort();
    expect(englishKeys.filter((key) => !thaiKeys.includes(key))).toEqual([]);
    expect(thaiKeys.filter((key) => !englishKeys.includes(key))).toEqual([]);
  });

  it("leaves no English entry still holding Thai text", () => {
    const thaiCharacters = /[\u0E00-\u0E7F]/;
    const untranslated = paths(en).filter((key) => thaiCharacters.test(String(t("en", key))));
    expect(untranslated).toEqual([]);
  });

  it("resolves every key in both languages", () => {
    for (const key of paths(th)) {
      expect(String(t("th", key)).length).toBeGreaterThan(0);
      expect(String(t("en", key)).length).toBeGreaterThan(0);
    }
  });

  it("marks an unknown key loudly during development", () => {
    const previous = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = "development";
    expect(t("th", "fleet.doesNotExist" as I18nKey)).toBe("⟦fleet.doesNotExist⟧");
    (process.env as Record<string, string>).NODE_ENV = previous ?? "test";
  });
});
