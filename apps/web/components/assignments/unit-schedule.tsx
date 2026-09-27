import type { Mission } from "@tomp/types/domain";
import { formatStatusTh } from "@/lib/i18n/status-th";
import { mainJobDays } from "@/lib/domain/job-schedule";

export interface ScheduleJob {
  id: string;
  /** Running order on the driver's screen, 1-based. */
  order: number;
  status: string;
  /** Bangkok calendar day, YYYY-MM-DD; "" when the job has no start time. */
  day: string;
  time: string;
  route: string;
}

// Past this many days a unit's plan reads better as the days that have work.
const MAX_LISTED_DAYS = 45;

const dayLabel = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
const rangeLabel = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });

function noon(date: string) {
  return new Date(`${date}T12:00:00+07:00`);
}

function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let at = noon(from).getTime(); at <= noon(to).getTime() && days.length <= MAX_LISTED_DAYS; at += 86_400_000) {
    days.push(new Date(at).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }));
  }
  return days;
}

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  completed: "bg-slate-100 text-ink-faint",
  acknowledged: "bg-blue-50 text-blue-800",
  ready: "bg-blue-50 text-blue-800"
};

/**
 * One unit's work over its whole main job, day by day: the control room sees
 * which days are booked, which are free, and what each job is, without opening
 * the dispatch board.
 */
export function UnitSchedule({
  mission,
  jobs,
  projectStartDate,
  projectEndDate
}: {
  mission?: Mission;
  jobs: ScheduleJob[];
  projectStartDate?: string | null;
  projectEndDate?: string | null;
}) {
  const main = mission ? mainJobDays(mission) : null;
  const from = main?.from || projectStartDate || jobs.find((job) => job.day)?.day || "";
  const to = main?.to || projectEndDate || [...jobs].reverse().find((job) => job.day)?.day || from;
  const range = from && to >= from ? daysBetween(from, to) : [];
  const tooLong = range.length > MAX_LISTED_DAYS;
  const byDay = new Map<string, ScheduleJob[]>();
  for (const job of jobs) byDay.set(job.day, [...(byDay.get(job.day) ?? []), job]);
  const listed = tooLong ? [...byDay.keys()].filter(Boolean).sort() : range;
  const outside = jobs.filter((job) => !job.day || (!tooLong && !range.includes(job.day)));
  const bookedDays = range.filter((day) => byDay.has(day)).length;

  return (
    <section className="grid min-w-0 content-start gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-ink-faint">ภารกิจหลัก</p>
          <p className="truncate text-[13px] font-bold text-ink">
            {mission ? mission.missionName : "ยังไม่กำหนดภารกิจหลัก"}
            {mission?.missionCode ? <span className="ml-1.5 font-normal text-ink-faint">{mission.missionCode}</span> : null}
          </p>
        </div>
        {from ? (
          <p className="text-[11px] text-ink-soft">
            {rangeLabel.format(noon(from))}
            {to !== from ? ` – ${rangeLabel.format(noon(to))}` : ""}
            {range.length && !tooLong ? ` · มีงาน ${bookedDays}/${range.length} วัน` : ""}
            {` · ${jobs.length} งาน`}
          </p>
        ) : null}
      </div>

      {listed.length ? (
        <ol className="grid gap-1.5 sm:grid-cols-2 2xl:grid-cols-3">
          {listed.map((day) => {
            const dayJobs = byDay.get(day) ?? [];
            return (
              <li
                key={day}
                className={`grid min-w-0 gap-1 rounded-xl border px-2.5 py-1.5 ${dayJobs.length ? "border-slate-200 bg-white" : "border-dashed border-slate-200 bg-slate-50/60"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[12px] font-bold ${dayJobs.length ? "text-ink" : "text-ink-faint"}`}>{dayLabel.format(noon(day))}</span>
                  <span className="text-[10px] font-semibold text-ink-faint">{dayJobs.length ? `${dayJobs.length} งาน` : "ว่าง"}</span>
                </div>
                {dayJobs.map((job) => (
                  <JobLine key={job.id} job={job} />
                ))}
              </li>
            );
          })}
        </ol>
      ) : null}

      {outside.length ? (
        <div className="grid gap-1 rounded-xl border border-amber-200 bg-amber-50/60 px-2.5 py-1.5">
          <p className="text-[11px] font-semibold text-amber-900">นอกช่วงภารกิจหลักหรือยังไม่ระบุวัน</p>
          {outside.map((job) => (
            <JobLine key={job.id} job={job} />
          ))}
        </div>
      ) : null}

      {!jobs.length ? <p className="text-[12px] text-ink-soft">ยังไม่มีงานย่อย เพิ่มได้ที่ “ขั้นที่ 2”</p> : null}
    </section>
  );
}

function JobLine({ job }: { job: ScheduleJob }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[12px]">
      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-slate-100 text-[9px] font-bold text-ink-soft">{job.order}</span>
      <span className="shrink-0 font-semibold tabular-nums text-ink">{job.time}</span>
      <span className="min-w-0 flex-1 truncate text-ink-soft" title={job.route}>
        {job.route}
      </span>
      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_TONE[job.status] ?? "bg-slate-100 text-ink-soft"}`}>
        {formatStatusTh(job.status)}
      </span>
    </div>
  );
}
