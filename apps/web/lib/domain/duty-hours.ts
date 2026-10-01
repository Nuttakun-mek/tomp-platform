// A unit's duty hours: the clock-in and clock-out agreed for each day of its
// main job (set in step 1, changeable per day). Overtime is measured against
// these, never against sub-job times — a driver who works 13:00–14:00 then
// 14:00–15:00 inside a 07:00–17:00 day is not on overtime at 14:01.
//
// Owner's rules (2026-09-30, 2026-10-01):
//   - clocking in before the scheduled start is not overtime, and the day
//     still ends at the scheduled end;
//   - clocking in late moves the end out by the same amount, so the driver
//     still works the day's full scheduled length (08:00–18:00, in at 08:30,
//     out at 18:30) — overtime starts after that;
//   - every minute past the end is overtime;
//   - the control room can set a unit's end, or its real clock-out, for a day
//     on the day-close page (a DutyAdjustment), with a reason.

export interface DutyHours {
  /** "HH:MM", Bangkok time. */
  start: string;
  /** "HH:MM"; at or before `start` means the next morning. */
  end: string;
}

/** Bangkok date "YYYY-MM-DD" → that day's hours. Stored on the mission as metadata.dutyHours. */
export type DutySchedule = Record<string, DutyHours>;

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isClock(value: unknown): value is string {
  return typeof value === "string" && CLOCK.test(value);
}

export function readDutySchedule(metadata: Record<string, unknown> | null | undefined): DutySchedule {
  const raw = metadata?.dutyHours;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: DutySchedule = {};
  for (const [date, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !value || typeof value !== "object") continue;
    const { start, end } = value as Record<string, unknown>;
    if (isClock(start) && isClock(end)) out[date] = { start, end };
  }
  return out;
}

/** The control room's correction of one unit's day, kept on its main job. */
export interface DutyAdjustment {
  /** When overtime starts, instead of the computed end. */
  endAt?: string | null;
  /** The real clock-out, when the driver's is missing or wrong. */
  clockOutAt?: string | null;
  reason?: string;
  by?: string | null;
  at?: string;
}

/** metadata.dutyAdjustments[date][unitId] — per day, per Call Sign. */
export function readDutyAdjustment(metadata: Record<string, unknown> | null | undefined, date: string, unitId: string | null | undefined): DutyAdjustment | null {
  if (!unitId) return null;
  const all = metadata?.dutyAdjustments;
  if (!all || typeof all !== "object" || Array.isArray(all)) return null;
  const day = (all as Record<string, unknown>)[date];
  if (!day || typeof day !== "object" || Array.isArray(day)) return null;
  const entry = (day as Record<string, unknown>)[unitId];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const value = entry as Record<string, unknown>;
  const iso = (v: unknown) => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null);
  const adjustment: DutyAdjustment = {
    endAt: iso(value.endAt),
    clockOutAt: iso(value.clockOutAt),
    reason: typeof value.reason === "string" ? value.reason : undefined,
    by: typeof value.by === "string" ? value.by : null,
    at: typeof value.at === "string" ? value.at : undefined
  };
  return adjustment.endAt || adjustment.clockOutAt ? adjustment : null;
}

/** Every day from `from` to `to`, each with `hours` unless `overrides` says otherwise. */
export function buildDutySchedule(from: string, to: string, hours: DutyHours, overrides: DutySchedule = {}): DutySchedule {
  const out: DutySchedule = {};
  for (const day of daysBetween(from, to)) out[day] = overrides[day] ?? hours;
  return out;
}

export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  const start = Date.parse(`${from}T12:00:00+07:00`);
  const end = Date.parse(`${to}T12:00:00+07:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return days;
  for (let at = start; at <= end && days.length < 400; at += 86_400_000) {
    days.push(new Date(at).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }));
  }
  return days;
}

/** The instants a day's duty starts and ends. */
export function dutyWindow(date: string, hours: DutyHours): { start: string; end: string } {
  const start = new Date(`${date}T${hours.start}:00+07:00`);
  const end = new Date(`${date}T${hours.end}:00+07:00`);
  if (end.getTime() <= start.getTime()) end.setTime(end.getTime() + 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function dutyLengthHours(hours: DutyHours): number {
  const window = dutyWindow("2026-01-01", hours);
  return Math.round(((Date.parse(window.end) - Date.parse(window.start)) / 3_600_000) * 100) / 100;
}

export interface DutyDayCost {
  dutyStart: string;
  /** When overtime starts: the scheduled end, moved out for a late clock-in, or set by the control room. */
  dutyEnd: string;
  /** The day's end as scheduled. */
  scheduledEnd: string;
  /** The end the rules give (scheduled, or moved out for a late clock-in), before any correction. */
  computedEnd: string;
  endBasis: "scheduled" | "late_start" | "adjusted";
  /** The driver's own clock-out, when the control room replaced it. */
  recordedClockOut: string | null;
  clockOutAdjusted: boolean;
  /** Where the window came from: the mission's duty hours, or (not set) the day's first and last sub-job. */
  source: "duty_hours" | "sub_jobs";
  scheduledHours: number;
  clockIn: string | null;
  clockOut: string | null;
  /** Clocked in and not out, counted up to `now`. */
  running: boolean;
  overtimeHours: number;
  rate: number | null;
  baseAmount: number | null;
  overtimeAmount: number | null;
  total: number | null;
  state: "not_started" | "on_duty" | "overtime" | "done" | "no_clock_out";
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null);

/**
 * What a unit's day costs. The base is the scheduled duty day paid by the hour
 * at the package rate (package amount ÷ package hours) — shorter and longer
 * days alike; overtime is only the time past the day's end (duty-hours rules
 * above), at the same rate.
 */
export function dutyDayCost(input: {
  window: { start: string; end: string };
  source: DutyDayCost["source"];
  clockIn: string | null;
  clockOut: string | null;
  /** Given for today: a driver still clocked in is counted to now. */
  now?: number;
  vehicleMetadata?: Record<string, unknown> | null;
  adjustment?: DutyAdjustment | null;
}): DutyDayCost {
  const meta = input.vehicleMetadata ?? {};
  const packageHours = num(meta.packageHours) ?? num(meta.minimumHours);
  const packageAmount = num(meta.packageAmount);
  const rate = packageAmount != null && packageHours ? packageAmount / packageHours : num(meta.hourlyRate);

  const dutyStartMs = Date.parse(input.window.start);
  const scheduledEndMs = Date.parse(input.window.end);
  const scheduledHours = round2((scheduledEndMs - dutyStartMs) / 3_600_000);

  // Late in, late out: the day keeps its scheduled length from the real clock-in.
  const clockInMs = input.clockIn ? Date.parse(input.clockIn) : Number.NaN;
  const lateBy = Number.isFinite(clockInMs) ? Math.max(0, clockInMs - dutyStartMs) : 0;
  const adjustedEnd = input.adjustment?.endAt ?? null;
  const dutyEndMs = adjustedEnd ? Date.parse(adjustedEnd) : scheduledEndMs + lateBy;
  const endBasis: DutyDayCost["endBasis"] = adjustedEnd ? "adjusted" : lateBy > 0 ? "late_start" : "scheduled";

  const clockOutAdjusted = Boolean(input.adjustment?.clockOutAt);
  const clockOut = input.adjustment?.clockOutAt ?? input.clockOut;
  const running = Boolean(input.clockIn && !clockOut && input.now != null);
  const actualEndMs = clockOut ? Date.parse(clockOut) : running ? input.now! : null;
  const overtimeHours = input.clockIn && actualEndMs != null ? round2(Math.max(0, actualEndMs - dutyEndMs) / 3_600_000) : 0;

  // The scheduled hours at the package's hourly rate (owner, 2026-10-01): a
  // 1-hour day is one hour, not the whole 10-hour package. A day exactly the
  // package's length is the package amount, without rounding drift.
  const baseAmount =
    rate == null
      ? null
      : packageAmount != null && packageHours != null && scheduledHours === packageHours
        ? packageAmount
        : round2(scheduledHours * rate);
  const overtimeAmount = rate == null ? null : round2(overtimeHours * rate);

  const state: DutyDayCost["state"] = !input.clockIn
    ? "not_started"
    : clockOut
      ? "done"
      : running
        ? overtimeHours > 0
          ? "overtime"
          : "on_duty"
        : "no_clock_out";

  return {
    dutyStart: input.window.start,
    dutyEnd: new Date(dutyEndMs).toISOString(),
    scheduledEnd: input.window.end,
    computedEnd: new Date(scheduledEndMs + lateBy).toISOString(),
    endBasis,
    recordedClockOut: input.clockOut,
    clockOutAdjusted,
    source: input.source,
    scheduledHours,
    clockIn: input.clockIn,
    clockOut,
    running,
    overtimeHours,
    rate: rate == null ? null : round2(rate),
    baseAmount,
    overtimeAmount,
    total: baseAmount == null ? null : round2(baseAmount + (overtimeAmount ?? 0)),
    state
  };
}

/**
 * The duty window for a unit on a day: the mission's hours for that day, or —
 * when none were set — the span of that day's sub-jobs, so nothing breaks.
 */
export function resolveDutyWindow(
  date: string,
  schedule: DutySchedule,
  jobs: Array<{ startTime?: string | null; endTime?: string | null }>
): { window: { start: string; end: string }; source: DutyDayCost["source"] } | null {
  const hours = schedule[date];
  if (hours) return { window: dutyWindow(date, hours), source: "duty_hours" };
  const starts = jobs.map((job) => job.startTime).filter((value): value is string => Boolean(value)).sort();
  const ends = jobs.map((job) => job.endTime).filter((value): value is string => Boolean(value)).sort();
  if (!starts.length || !ends.length) return null;
  return { window: { start: starts[0], end: ends[ends.length - 1] }, source: "sub_jobs" };
}

const clock = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
export function formatDutyWindow(window: { start: string; end: string }) {
  return `${clock.format(new Date(window.start))}–${clock.format(new Date(window.end))}`;
}

export interface DutyStatus {
  tone: "neutral" | "success" | "warning" | "danger";
  label: string;
  detail: string;
}

/** Warn this long before the scheduled clock-out, while the driver is still on duty. */
export const DUTY_END_WARNING_MIN = 15;

/**
 * One unit's day, everything the control room shows about its hours: the duty
 * window (the mission's hours, or the day's sub-jobs when none were set), the
 * driver's shift matched to that day, the cost, and a status to display.
 */
export function unitDutyDay(input: {
  date: string;
  schedule: DutySchedule;
  jobs: Array<{ startTime?: string | null; endTime?: string | null }>;
  session: { startedAt: string | null; endedAt: string | null } | null | undefined;
  now?: number;
  vehicleMetadata?: Record<string, unknown> | null;
  adjustment?: DutyAdjustment | null;
}): { cost: DutyDayCost; status: DutyStatus } | null {
  const resolved = resolveDutyWindow(input.date, input.schedule, input.jobs);
  if (!resolved) return null;
  const windowStart = Date.parse(resolved.window.start);
  const windowEnd = Date.parse(resolved.window.end);
  // The shift that belongs to this day: clocked in no more than 12 h before the
  // duty starts and not after it ends; its clock-out, if any, comes after.
  const startedAt = input.session?.startedAt ? Date.parse(input.session.startedAt) : Number.NaN;
  const clockIn = Number.isFinite(startedAt) && startedAt >= windowStart - 12 * 3_600_000 && startedAt <= windowEnd ? input.session!.startedAt : null;
  const clockOut = clockIn && input.session?.endedAt && Date.parse(input.session.endedAt) > startedAt ? input.session.endedAt : null;

  const cost = dutyDayCost({ window: resolved.window, source: resolved.source, clockIn, clockOut, now: input.now, vehicleMetadata: input.vehicleMetadata, adjustment: input.adjustment });
  const endMs = Date.parse(cost.dutyEnd);
  const hhmm = (iso: string) => clock.format(new Date(iso));
  const money = (n: number | null) => (n == null ? "" : ` ≈ ${n.toLocaleString("th-TH")} บ.`);
  const fallback =
    (cost.endBasis === "late_start"
      ? ` · เข้าช้า เลื่อนเวลาออกจาก ${hhmm(cost.scheduledEnd)} เป็น ${hhmm(cost.dutyEnd)}`
      : cost.endBasis === "adjusted"
        ? ` · ศูนย์กำหนดเวลาออก ${hhmm(cost.dutyEnd)}`
        : "") + (resolved.source === "sub_jobs" ? " (ยังไม่ได้ตั้งเวลาเข้า-ออก ใช้ช่วงงานย่อยแทน)" : "");
  const now = input.now ?? Date.now();

  let status: DutyStatus;
  if (cost.state === "not_started") {
    const late = now >= windowStart;
    status = late
      ? { tone: "warning", label: "ยังไม่เข้างาน", detail: `เลยเวลาเข้างาน ${hhmm(resolved.window.start)} มาแล้ว${fallback}` }
      : { tone: "neutral", label: `เข้างาน ${hhmm(resolved.window.start)}`, detail: `เวลางาน ${formatDutyWindow(resolved.window)}${fallback}` };
  } else if (cost.state === "on_duty") {
    const untilEnd = endMs - now;
    status =
      untilEnd <= DUTY_END_WARNING_MIN * 60_000
        ? { tone: "warning", label: `ใกล้เวลาออกงาน ${hhmm(cost.dutyEnd)}`, detail: `อีก ${Math.max(0, Math.round(untilEnd / 60_000))} นาทีจะเริ่มคิด OT${fallback}` }
        : { tone: "success", label: `ในเวลางาน ถึง ${hhmm(cost.dutyEnd)}`, detail: `เวลางาน ${formatDutyWindow(resolved.window)}${fallback}` };
  } else if (cost.state === "overtime") {
    status = { tone: "danger", label: `OT ${cost.overtimeHours.toLocaleString("th-TH")} ชม.`, detail: `เลยเวลาออกงาน ${hhmm(cost.dutyEnd)} ยังไม่บันทึกเวลาออก${money(cost.overtimeAmount)}${fallback}` };
  } else if (cost.state === "done") {
    status = cost.overtimeHours
      ? { tone: "warning", label: `ออกงานแล้ว · OT ${cost.overtimeHours.toLocaleString("th-TH")} ชม.`, detail: `ออก ${hhmm(cost.clockOut!)} หลังเวลาออกงาน ${hhmm(cost.dutyEnd)}${money(cost.overtimeAmount)}${fallback}` }
      : { tone: "success", label: "ออกงานตรงเวลา", detail: `ออก ${hhmm(cost.clockOut!)} · เวลางาน ${formatDutyWindow(resolved.window)}${fallback}` };
  } else {
    status = { tone: "warning", label: "ไม่ได้บันทึกเวลาออก", detail: `คิดตามเวลาออกงาน ${hhmm(cost.dutyEnd)} ไปก่อน${fallback}` };
  }
  return { cost, status };
}
