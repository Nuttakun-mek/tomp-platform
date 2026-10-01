import { dutyDayCost, resolveDutyWindow, type DutyAdjustment, type DutyDayCost, type DutySchedule } from "./duty-hours";

// The end-of-day summary for one project and one Bangkok calendar day: per
// unit (Call Sign), its scheduled clock-in/out (the main job's duty hours for
// the day), when the driver really clocked in and out, overtime, and what it
// costs. Vehicles are hired by the day, so the day is priced once per unit;
// overtime is only the time after the scheduled clock-out (duty-hours.ts).

export interface DayCloseJob {
  id: string;
  callSignId: string | null;
  driverId: string | null;
  vehicleId: string | null;
  status: string;
  startTime: string | null;
  endTime: string | null;
}

export interface DayCloseUnit {
  id: string;
  label: string;
  driverId: string | null;
  driverName: string | null;
  vehicleId: string | null;
  plate: string | null;
  vehicleMetadata: Record<string, unknown> | null;
}

export interface SessionEvent {
  driverId: string;
  status: "work_started" | "work_ended";
  at: string;
}

export interface DayCloseRow {
  unitId: string;
  label: string;
  driverName: string | null;
  plate: string | null;
  jobs: number;
  jobsDone: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  clockIn: string | null;
  clockOut: string | null;
  openIssues: number;
  cost: DutyDayCost;
  /** The control room's correction for this unit and day, if any. */
  adjustment: DutyAdjustment | null;
  notes: string[];
}

export interface DayCloseTotals {
  units: number;
  jobs: number;
  jobsDone: number;
  hours: number;
  overtimeHours: number;
  baseAmount: number;
  overtimeAmount: number;
  total: number;
  unpriced: number;
}

const bangkokDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });
export const bangkokDateOf = (iso: string) => bangkokDay.format(new Date(iso));

const CLOSED = new Set(["cancelled", "archived"]);
const clockLabel = (iso: string) => new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const round2 = (n: number) => Math.round(n * 100) / 100;

export function summarizeDay(input: {
  date: string;
  jobs: DayCloseJob[];
  units: DayCloseUnit[];
  sessions: SessionEvent[];
  /** Latest driver-reported status per job. */
  reported: Record<string, { status: string } | undefined>;
  /** Open issue reports per job. */
  openIssues: Record<string, number>;
  /** Each unit's duty hours (its main job's metadata.dutyHours), by unit id. */
  schedules?: Record<string, DutySchedule>;
  /** The control room's corrections for this day, by unit id. */
  adjustments?: Record<string, DutyAdjustment | null | undefined>;
  /** Given when the day is today: a driver still on the clock is counted to now. */
  now?: number;
}): { rows: DayCloseRow[]; totals: DayCloseTotals } {
  const dayJobs = input.jobs.filter((job) => job.startTime && !CLOSED.has(job.status) && bangkokDateOf(job.startTime) === input.date);
  const unitById = new Map(input.units.map((unit) => [unit.id, unit]));
  const byUnit = new Map<string, DayCloseJob[]>();
  for (const job of dayJobs) {
    const key = job.callSignId ?? `job:${job.id}`;
    byUnit.set(key, [...(byUnit.get(key) ?? []), job]);
  }

  const sessionsByDriver = new Map<string, SessionEvent[]>();
  for (const event of [...input.sessions].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    sessionsByDriver.set(event.driverId, [...(sessionsByDriver.get(event.driverId) ?? []), event]);
  }

  const rows: DayCloseRow[] = [];
  for (const [unitId, jobs] of byUnit) {
    const unit = unitById.get(unitId);
    const driverId = unit?.driverId ?? jobs[0].driverId;
    const starts = jobs.map((job) => job.startTime!).sort();
    const ends = jobs.map((job) => job.endTime).filter((end): end is string => Boolean(end)).sort();
    const plannedStart = starts[0] ?? null;
    const plannedEnd = ends[ends.length - 1] ?? null;

    // The day's duty window: the main job's hours for the day, or the span of
    // its sub-jobs when none were set.
    const resolved = resolveDutyWindow(input.date, input.schedules?.[unitId] ?? {}, jobs)!;
    const windowStart = Date.parse(resolved.window.start);
    const windowEnd = Date.parse(resolved.window.end);

    // The shift that belongs to this day: the first clock-in from 12 h before
    // the duty starts up to its end, and the first clock-out after it (which
    // may fall after midnight).
    const events = driverId ? sessionsByDriver.get(driverId) ?? [] : [];
    const clockInEvent = events.find(
      (event) => event.status === "work_started" && Date.parse(event.at) >= windowStart - 12 * 3_600_000 && Date.parse(event.at) <= windowEnd
    );
    const clockOutEvent = clockInEvent
      ? events.find((event) => event.status === "work_ended" && Date.parse(event.at) > Date.parse(clockInEvent.at))
      : undefined;
    const clockIn = clockInEvent?.at ?? null;
    const clockOut = clockOutEvent?.at ?? null;

    const adjustment = input.adjustments?.[unitId] ?? null;
    const cost = dutyDayCost({ window: resolved.window, source: resolved.source, clockIn, clockOut, now: input.now, vehicleMetadata: unit?.vehicleMetadata ?? null, adjustment });

    const jobsDone = jobs.filter((job) => job.status === "completed" || input.reported[job.id]?.status === "completed").length;
    const openIssues = jobs.reduce((sum, job) => sum + (input.openIssues[job.id] ?? 0), 0);
    const notes: string[] = [];
    if (resolved.source === "sub_jobs") notes.push("ยังไม่ได้ตั้งเวลาเข้า-ออกในขั้นที่ 1 — ใช้ช่วงงานย่อยแทน");
    if (!clockIn) notes.push("ไม่ได้บันทึกเวลาเข้า");
    else if (!cost.clockOut) notes.push(input.now ? "ยังไม่บันทึกเวลาออก — นับถึงตอนนี้" : "ไม่ได้บันทึกเวลาออก — ไม่คิด OT");
    if (cost.endBasis === "late_start") notes.push(`เข้าช้า — เวลาออกเลื่อนเป็น ${clockLabel(cost.dutyEnd)} ให้ครบ ${cost.scheduledHours} ชม.`);
    if (cost.endBasis === "adjusted") notes.push(`ศูนย์กำหนดเวลาออก ${clockLabel(cost.dutyEnd)}${adjustment?.reason ? ` — ${adjustment.reason}` : ""}`);
    if (cost.clockOutAdjusted) notes.push(`ศูนย์แก้เวลาออกงานจริงเป็น ${clockLabel(cost.clockOut!)}${cost.recordedClockOut ? ` (คนขับกด ${clockLabel(cost.recordedClockOut)})` : ""}${adjustment?.reason && cost.endBasis !== "adjusted" ? ` — ${adjustment.reason}` : ""}`);
    if (jobsDone < jobs.length) notes.push(`งานยังไม่ปิด ${jobs.length - jobsDone} งาน`);
    if (openIssues) notes.push(`เหตุขัดข้องค้าง ${openIssues} รายการ`);
    if (cost.total == null) notes.push("รถยังไม่มีอัตราค่าบริการ");

    rows.push({
      unitId,
      label: unit?.label ?? "ไม่มี Call Sign",
      driverName: unit?.driverName ?? null,
      plate: unit?.plate ?? null,
      jobs: jobs.length,
      jobsDone,
      plannedStart,
      plannedEnd,
      clockIn,
      clockOut: cost.clockOut,
      openIssues,
      cost,
      adjustment,
      notes
    });
  }
  rows.sort((a, b) => a.label.localeCompare(b.label, "th"));

  return { rows, totals: totalsOf(rows) };
}

/** The totals strip for any set of rows — one day, or many days filtered. */
export function totalsOf(rows: DayCloseRow[]): DayCloseTotals {
  return rows.reduce<DayCloseTotals>(
    (sum, row) => ({
      units: sum.units + 1,
      jobs: sum.jobs + row.jobs,
      jobsDone: sum.jobsDone + row.jobsDone,
      hours: round2(sum.hours + row.cost.scheduledHours + row.cost.overtimeHours),
      overtimeHours: round2(sum.overtimeHours + row.cost.overtimeHours),
      baseAmount: round2(sum.baseAmount + (row.cost.baseAmount ?? 0)),
      overtimeAmount: round2(sum.overtimeAmount + (row.cost.overtimeAmount ?? 0)),
      total: round2(sum.total + (row.cost.total ?? 0)),
      unpriced: sum.unpriced + (row.cost.total == null ? 1 : 0)
    }),
    { units: 0, jobs: 0, jobsDone: 0, hours: 0, overtimeHours: 0, baseAmount: 0, overtimeAmount: 0, total: 0, unpriced: 0 }
  );
}

// ---- The whole project: many days, filtered ----

export const DAY_CLOSE_FLAGS = {
  ot: "มี OT",
  no_clock_in: "ไม่ได้บันทึกเวลาเข้า",
  no_clock_out: "ไม่ได้บันทึกเวลาออก",
  open_jobs: "งานยังไม่ปิด",
  adjusted: "ศูนย์แก้เวลา",
  unpriced: "รถยังไม่มีราคา"
} as const;
export type DayCloseFlag = keyof typeof DAY_CLOSE_FLAGS;

export function isDayCloseFlag(value: string): value is DayCloseFlag {
  return Object.prototype.hasOwnProperty.call(DAY_CLOSE_FLAGS, value);
}

/** What needs a second look on a row, for the project view's filters. */
export function rowFlags(row: DayCloseRow): DayCloseFlag[] {
  const flags: DayCloseFlag[] = [];
  if (row.cost.overtimeHours > 0) flags.push("ot");
  if (!row.clockIn) flags.push("no_clock_in");
  else if (!row.clockOut) flags.push("no_clock_out");
  if (row.jobsDone < row.jobs) flags.push("open_jobs");
  if (row.adjustment || row.cost.endBasis === "adjusted" || row.cost.clockOutAdjusted) flags.push("adjusted");
  if (row.cost.total == null) flags.push("unpriced");
  return flags;
}

export interface DayCloseDay {
  date: string;
  rows: DayCloseRow[];
  totals: DayCloseTotals;
}

/**
 * Keep the units asked for, and rows that carry any of the flags asked for
 * (no flags = every row). Days left with no rows drop out; totals are
 * recounted from what is left.
 */
export function filterDayCloseDays(days: DayCloseDay[], filter: { units?: string[]; flags?: DayCloseFlag[] }): DayCloseDay[] {
  const units = filter.units?.length ? new Set(filter.units) : null;
  const flags = filter.flags?.length ? new Set(filter.flags) : null;
  return days
    .map((day) => {
      const rows = day.rows.filter((row) => (!units || units.has(row.unitId)) && (!flags || rowFlags(row).some((flag) => flags.has(flag))));
      return { date: day.date, rows, totals: totalsOf(rows) };
    })
    .filter((day) => day.rows.length > 0);
}

export interface DayCloseUnitSummary {
  unitId: string;
  label: string;
  driverName: string | null;
  plate: string | null;
  days: number;
  jobs: number;
  jobsDone: number;
  hours: number;
  overtimeHours: number;
  baseAmount: number;
  overtimeAmount: number;
  total: number;
  /** Days whose vehicle had no rate — not in the amounts. */
  unpricedDays: number;
}

/** One line per unit across the days: what to bill per Call Sign. */
export function summarizeByUnit(days: DayCloseDay[]): DayCloseUnitSummary[] {
  const byUnit = new Map<string, DayCloseUnitSummary>();
  for (const day of days) {
    for (const row of day.rows) {
      const held = byUnit.get(row.unitId) ?? {
        unitId: row.unitId,
        label: row.label,
        driverName: row.driverName,
        plate: row.plate,
        days: 0,
        jobs: 0,
        jobsDone: 0,
        hours: 0,
        overtimeHours: 0,
        baseAmount: 0,
        overtimeAmount: 0,
        total: 0,
        unpricedDays: 0
      };
      held.days += 1;
      held.jobs += row.jobs;
      held.jobsDone += row.jobsDone;
      held.hours = round2(held.hours + row.cost.scheduledHours + row.cost.overtimeHours);
      held.overtimeHours = round2(held.overtimeHours + row.cost.overtimeHours);
      held.baseAmount = round2(held.baseAmount + (row.cost.baseAmount ?? 0));
      held.overtimeAmount = round2(held.overtimeAmount + (row.cost.overtimeAmount ?? 0));
      held.total = round2(held.total + (row.cost.total ?? 0));
      if (row.cost.total == null) held.unpricedDays += 1;
      // The latest day's driver and plate: the crew can change mid-project.
      held.driverName = row.driverName ?? held.driverName;
      held.plate = row.plate ?? held.plate;
      byUnit.set(row.unitId, held);
    }
  }
  return [...byUnit.values()].sort((a, b) => a.label.localeCompare(b.label, "th"));
}
