// The rules that keep a project's jobs consistent, checked in the form for a
// quick answer and again on the server, which is the one that counts:
//
//   project (start_date … end_date)
//     └ main job (mission): a range of days inside the project
//         └ sub-job (assignment): one start and end time inside the main job,
//           never overlapping another job of the same driver or vehicle.
//           Back to back is fine: a job may start exactly when the last ended.

export interface ScheduledJob {
  startTime?: string | null;
  endTime?: string | null;
  label?: string | null;
}

const bangkokDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });
const bangkokClock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false });
const bangkokDate = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });

/** "2026-09-25" — the Bangkok calendar day of an instant. */
export function bangkokDateOf(iso: string): string {
  return bangkokDay.format(new Date(iso));
}

function thaiDay(date: string) {
  return bangkokDate.format(new Date(`${date}T12:00:00+07:00`));
}

export function describeJobWindow(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const sameDay = bangkokDay.format(start) === bangkokDay.format(end);
  return `${bangkokDate.format(start)} ${bangkokClock.format(start)}–${sameDay ? "" : `${bangkokDate.format(end)} `}${bangkokClock.format(end)}`;
}

/** A main job's day range must sit inside the project's. Dates are YYYY-MM-DD. */
export function checkMainJobDays(
  job: { from: string; to: string },
  project: { startDate?: string | null; endDate?: string | null }
): string | null {
  if (!job.from) return "เลือกวันที่ของภารกิจหลัก";
  if (job.to < job.from) return "วันที่สิ้นสุดอยู่ก่อนวันที่เริ่ม";
  if (project.startDate && job.from < project.startDate) return `ภารกิจหลักเริ่มก่อนวันเริ่มโครงการ (${thaiDay(project.startDate)})`;
  if (project.endDate && job.to > project.endDate) return `ภารกิจหลักจบหลังวันสิ้นสุดโครงการ (${thaiDay(project.endDate)})`;
  return null;
}

/**
 * Every reason a sub-job cannot be saved, in the order a person would fix them.
 * `mainJob` and `project` bound the day; `others` are the jobs already given
 * to the same driver or vehicle (cancelled ones left out by the caller).
 */
export function checkSubJob(input: {
  startTime: string;
  endTime: string;
  mainJob?: { from: string; to: string } | null;
  project?: { startDate?: string | null; endDate?: string | null } | null;
  others: ScheduledJob[];
}): string[] {
  const start = Date.parse(input.startTime);
  const end = Date.parse(input.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return ["เวลาเริ่มหรือเวลาจบไม่ถูกต้อง"];
  if (end <= start) return ["เวลาจบต้องอยู่หลังเวลาเริ่ม"];

  const problems: string[] = [];
  const startDay = bangkokDateOf(input.startTime);
  const endDay = bangkokDateOf(input.endTime);
  const main = input.mainJob;
  if (main?.from && (startDay < main.from || endDay > (main.to || main.from))) {
    problems.push(
      `งานย่อยต้องอยู่ในช่วงของภารกิจหลัก (${thaiDay(main.from)}${main.to && main.to !== main.from ? ` – ${thaiDay(main.to)}` : ""})`
    );
  }
  const project = input.project;
  if (project?.startDate && startDay < project.startDate) problems.push(`งานย่อยเริ่มก่อนวันเริ่มโครงการ (${thaiDay(project.startDate)})`);
  if (project?.endDate && endDay > project.endDate) problems.push(`งานย่อยจบหลังวันสิ้นสุดโครงการ (${thaiDay(project.endDate)})`);

  for (const other of input.others) {
    if (!other.startTime || !other.endTime) continue;
    const otherStart = Date.parse(other.startTime);
    const otherEnd = Date.parse(other.endTime);
    if (!Number.isFinite(otherStart) || !Number.isFinite(otherEnd)) continue;
    // Strict on both sides: 08:00–10:00 then 10:00–12:00 is back to back, not an overlap.
    if (start < otherEnd && otherStart < end) {
      problems.push(`ทับเวลากับงาน ${other.label?.trim() || "เดิม"} (${describeJobWindow(other.startTime, other.endTime)})`);
    }
  }
  return problems;
}

/**
 * A main job's days. The form stores them in metadata; planned times are the
 * fallback for older rows (their date part is the day the form picked).
 */
export function mainJobDays(mission: { plannedStartTime?: string | null; plannedEndTime?: string | null; metadata?: Record<string, unknown> | null }): {
  from: string;
  to: string;
} {
  const meta = mission.metadata ?? {};
  const metaFrom = typeof meta.operationStartDate === "string" ? meta.operationStartDate : typeof meta.operationDate === "string" ? meta.operationDate : "";
  const metaTo = typeof meta.operationEndDate === "string" ? meta.operationEndDate : "";
  const from = (metaFrom || String(mission.plannedStartTime ?? "")).slice(0, 10);
  const to = (metaTo || String(mission.plannedEndTime ?? "") || from).slice(0, 10);
  return { from, to: to || from };
}
