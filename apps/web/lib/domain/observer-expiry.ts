const DAY_MS = 24 * 60 * 60 * 1000;

interface ProjectObserverExpiryOptions {
  now?: Date;
  minimumDays?: number;
  fallbackDays?: number;
}

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Project-wide fleet links may be issued after an operation date has passed,
 * for example when an operator wants to share post-event tracking with a
 * customer. Never return a timestamp in the past; an already-dead QR reads as
 * an access failure rather than an expiry decision.
 */
export function getDefaultProjectObserverExpiry(
  endDate: string | null | undefined,
  options: ProjectObserverExpiryOptions = {}
): string {
  const now = options.now ?? new Date();
  const minimumDays = options.minimumDays ?? 7;
  const fallbackDays = options.fallbackDays ?? 30;
  const minimum = addDays(now, minimumDays);
  const projectEnd = validDate(endDate);

  if (!projectEnd) return addDays(now, fallbackDays).toISOString();

  const afterProjectEnd = addDays(projectEnd, 1);
  return new Date(Math.max(afterProjectEnd.getTime(), minimum.getTime())).toISOString();
}

export function normalizeFutureExpiry(value: string | null | undefined, options: { now?: Date } = {}): string | null {
  const date = validDate(value);
  if (!date) return null;
  const now = options.now ?? new Date();
  return date.getTime() > now.getTime() ? date.toISOString() : null;
}

export function formatObserverExpiryLabel(expiresAt: string | null | undefined, locale = "th-TH") {
  const date = validDate(expiresAt);
  if (!date) return "ยังไม่ระบุวันหมดอายุ";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok"
  }).format(date);
}
