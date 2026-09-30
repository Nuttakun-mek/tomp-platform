// Which of a unit's jobs the driver's page is about right now.
//
// A unit carries every day of the project, so "the best status" is not enough:
// ranking by status alone put tomorrow's 08:00 `planned` job above today's
// finished work, and the moment the last job of the day closed the driver was
// sent back to the pre-start check for a day that had not begun. The day
// (Bangkok) comes first, then the status:
//
//   1. a job under way — whatever its day (a late job runs past midnight)
//   2. today's jobs not yet started, earliest first
//   3. today's finished work — the day is done, the page says so
//   4. a later day's job — the page waits for that day
//   5. an earlier day's job never started
//   6. anything else (older finished work), latest first

export interface UnitJobRow {
  id: string;
  status: string;
  startTime: string | null;
  createdAt: string | null;
}

export const IN_PROGRESS_STATUSES = ["active", "acknowledged", "ready"];
export const NOT_STARTED_STATUSES = ["published", "planned", "draft", "parked"];

const bangkokDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });

export function bangkokDayOf(value: string | Date) {
  return bangkokDay.format(typeof value === "string" ? new Date(value) : value);
}

/** Today, before or after: a job with no start time counts as today's. */
function dayRelation(job: UnitJobRow, today: string): "today" | "future" | "past" {
  if (!job.startTime) return "today";
  const day = bangkokDayOf(job.startTime);
  return day === today ? "today" : day > today ? "future" : "past";
}

function tier(job: UnitJobRow, today: string) {
  if (job.status === "cancelled") return 99;
  if (IN_PROGRESS_STATUSES.includes(job.status)) return 1;
  const relation = dayRelation(job, today);
  const notStarted = NOT_STARTED_STATUSES.includes(job.status);
  if (notStarted && relation === "today") return 2;
  if (job.status === "completed" && relation === "today") return 3;
  if (notStarted && relation === "future") return 4;
  if (notStarted) return 5;
  return 6;
}

const ms = (value: string | null) => (value ? Date.parse(value) : Number.NaN);

function byStart(a: UnitJobRow, b: UnitJobRow) {
  const aStart = ms(a.startTime);
  const bStart = ms(b.startTime);
  if (Number.isFinite(aStart) && Number.isFinite(bStart) && aStart !== bStart) return aStart - bStart;
  if (Number.isFinite(aStart) !== Number.isFinite(bStart)) return Number.isFinite(aStart) ? -1 : 1;
  return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
}

export function pickCurrentJob<T extends UnitJobRow>(jobs: readonly T[], now: Date = new Date()): T | null {
  const today = bangkokDayOf(now);
  const ranked = jobs
    .map((job) => ({ job, tier: tier(job, today) }))
    .filter((entry) => entry.tier < 99)
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      // Finished work and old leftovers: the latest is the one that matters.
      return a.tier === 3 || a.tier >= 5 ? byStart(b.job, a.job) : byStart(a.job, b.job);
    });
  return ranked[0]?.job ?? null;
}

/** The current job is a later day's and nothing is under way: wait for that day. */
export function isLaterDayJob(job: { status: string; startTime: string | null }, now: Date = new Date()) {
  return NOT_STARTED_STATUSES.includes(job.status) && Boolean(job.startTime) && bangkokDayOf(job.startTime as string) > bangkokDayOf(now);
}
