import { normalizeLocale, type LocaleCode } from "./locales";
import { formatStatusTh } from "./status-th";

const statusEn: Record<string, string> = {
  active: "Active",
  archived: "Archived",
  assigned: "Assigned",
  available: "Available",
  cancelled: "Cancelled",
  completed: "Completed",
  critical: "Critical",
  draft: "Draft",
  in_progress: "In progress",
  planned: "Planned",
  published: "Published",
  ready: "Ready",
  warning: "Needs attention"
};

export function localeTag(locale: LocaleCode): string {
  return locale === "en" ? "en-US" : "th-TH";
}

export function formatStatus(status: string | null | undefined, locale: LocaleCode): string {
  const key = status || "";
  if (normalizeLocale(locale) === "th") return formatStatusTh(key);
  return statusEn[key] ?? key.replace(/_/g, " ");
}

export function formatDateTime(value: string | number | Date, locale: LocaleCode, options: Intl.DateTimeFormatOptions = {}) {
  return new Date(value).toLocaleString(localeTag(locale), {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
    ...options
  });
}
