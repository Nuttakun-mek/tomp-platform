"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import type { Mission } from "@tomp/types/domain";
import { setAssignmentOrderAction } from "@/app/actions/assignments";
import { JobStatusChip } from "@/components/ui/job-status-chip";
import { readDutySchedule } from "@/lib/domain/duty-hours";
import { mainJobDays } from "@/lib/domain/job-schedule";
import { DutyHoursChip } from "./duty-hours-chip";

export interface ScheduleJob {
  id: string;
  /** Running order on the driver's screen, 1-based. */
  order: number;
  status: string;
  /** Bangkok calendar day, YYYY-MM-DD; "" when the job has no start time. */
  day: string;
  time: string;
  route: string;
  urgent: boolean;
}

/** Unfolds step 2 (setup-step.tsx), then fills the sub-job form (create-assignment-form.tsx). */
export const OPEN_JOB_FORM_EVENT = "tomp:open-job-form";
export const NEW_JOB_EVENT = "tomp:new-job";

// Past this many days a unit's plan reads better as the days that have work.
const MAX_LISTED_DAYS = 45;
// Jobs the driver has not finished can still be moved.
const MOVABLE = new Set(["draft", "planned", "published", "acknowledged", "ready", "parked"]);

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

/**
 * One unit's work over its whole main job, day by day: which days are booked,
 * which are free, and what each job is. The running order and the urgent flag
 * are set here too — this replaced the separate "ลำดับงานต่อ Call Sign" panel,
 * which listed the same jobs again.
 */
export function UnitSchedule({
  projectId,
  callSignId,
  mission,
  jobs,
  projectStartDate,
  projectEndDate,
  canAddJobs = true
}: {
  projectId: string;
  callSignId: string;
  mission?: Mission;
  jobs: ScheduleJob[];
  projectStartDate?: string | null;
  projectEndDate?: string | null;
  canAddJobs?: boolean;
}) {
  const [order, setOrder] = useState(() => jobs.map((job) => job.id));
  const [urgent, setUrgent] = useState(() => new Set(jobs.filter((job) => job.urgent).map((job) => job.id)));
  const [saved, setSaved] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // The server's order wins whenever it changes (a job added, a save landed).
  const serverKey = jobs.map((job) => `${job.id}:${job.urgent}`).join("|");
  const [seenKey, setSeenKey] = useState(serverKey);
  if (seenKey !== serverKey) {
    setSeenKey(serverKey);
    setOrder(jobs.map((job) => job.id));
    setUrgent(new Set(jobs.filter((job) => job.urgent).map((job) => job.id)));
  }

  const byId = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const ordered = order.map((id) => byId.get(id)).filter((job): job is ScheduleJob => Boolean(job));
  const dirty = order.join("|") !== jobs.map((job) => job.id).join("|") || jobs.some((job) => job.urgent !== urgent.has(job.id));

  const main = mission ? mainJobDays(mission) : null;
  const duty = readDutySchedule(mission?.metadata as Record<string, unknown> | undefined);
  const from = main?.from || projectStartDate || jobs.find((job) => job.day)?.day || "";
  const to = main?.to || projectEndDate || [...jobs].reverse().find((job) => job.day)?.day || from;
  const range = from && to >= from ? daysBetween(from, to) : [];
  const tooLong = range.length > MAX_LISTED_DAYS;
  const byDay = new Map<string, ScheduleJob[]>();
  for (const job of ordered) byDay.set(job.day, [...(byDay.get(job.day) ?? []), job]);
  const listed = tooLong ? [...byDay.keys()].filter(Boolean).sort() : range;
  const outside = ordered.filter((job) => !job.day || (!tooLong && !range.includes(job.day)));
  const bookedDays = range.filter((day) => byDay.has(day)).length;

  function move(id: string, delta: -1 | 1) {
    const day = byId.get(id)?.day ?? "";
    const sameDay = order.filter((other) => (byId.get(other)?.day ?? "") === day);
    const target = sameDay[sameDay.indexOf(id) + delta];
    if (!target) return;
    const next = [...order];
    const a = next.indexOf(id);
    const b = next.indexOf(target);
    [next[a], next[b]] = [next[b], next[a]];
    setOrder(next);
    setSaved(null);
  }

  function toggleUrgent(id: string) {
    setUrgent((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSaved(null);
  }

  function save() {
    startTransition(async () => {
      const result = await setAssignmentOrderAction({ projectId, callSignId, orderedAssignmentIds: order, urgentAssignmentIds: [...urgent] });
      setSaved(result.success ? "บันทึกลำดับแล้ว คนขับเห็นตามนี้" : result.error || "บันทึกไม่สำเร็จ");
    });
  }

  function addJob(day: string) {
    // The form is not mounted while step 2 is folded: unfold it first, then
    // hand over the unit and the day once it has rendered.
    window.dispatchEvent(new CustomEvent(OPEN_JOB_FORM_EVENT));
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(NEW_JOB_EVENT, { detail: { callSignId, date: day } }));
    }, 80);
  }

  const line = (job: ScheduleJob, dayJobs: ScheduleJob[]) => {
    const index = dayJobs.indexOf(job);
    const movable = MOVABLE.has(job.status) && dayJobs.length > 1;
    return (
      <JobLine
        key={job.id}
        job={job}
        position={order.indexOf(job.id) + 1}
        urgent={urgent.has(job.id)}
        onUrgent={MOVABLE.has(job.status) ? () => toggleUrgent(job.id) : undefined}
        onUp={movable && index > 0 ? () => move(job.id, -1) : undefined}
        onDown={movable && index < dayJobs.length - 1 ? () => move(job.id, 1) : undefined}
      />
    );
  };

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
        <div className="flex flex-wrap items-center gap-2">
          {from ? (
            <p className="text-[11px] text-ink-soft">
              {rangeLabel.format(noon(from))}
              {to !== from ? ` – ${rangeLabel.format(noon(to))}` : ""}
              {range.length && !tooLong ? ` · มีงาน ${bookedDays}/${range.length} วัน` : ""}
              {` · ${jobs.length} งาน`}
            </p>
          ) : null}
          {dirty ? (
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="rounded-full bg-operation px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              {isPending ? "กำลังบันทึก…" : "บันทึกลำดับ"}
            </button>
          ) : saved ? (
            <span className="text-[11px] font-semibold text-operation">{saved}</span>
          ) : null}
        </div>
      </div>

      {listed.length ? (
        <ol className="grid gap-1.5 sm:grid-cols-2 2xl:grid-cols-3">
          {listed.map((day) => {
            const dayJobs = byDay.get(day) ?? [];
            return (
              <li
                key={day}
                className={`group grid min-w-0 content-start gap-1 rounded-xl border px-2.5 py-1.5 ${dayJobs.length ? "border-slate-200 bg-white" : "border-dashed border-slate-200 bg-slate-50/60"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className={`text-[12px] font-bold ${dayJobs.length ? "text-ink" : "text-ink-faint"}`}>{dayLabel.format(noon(day))}</span>
                    {mission && main && day >= main.from && day <= main.to ? (
                      <DutyHoursChip key={`${day}-${duty[day]?.start}-${duty[day]?.end}`} projectId={projectId} missionId={mission.id} date={day} hours={duty[day] ?? null} />
                    ) : null}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-ink-faint">{dayJobs.length ? `${dayJobs.length} งาน` : "ว่าง"}</span>
                    {canAddJobs ? (
                      <button
                        type="button"
                        onClick={() => addJob(day)}
                        title="เพิ่มงานในวันนี้"
                        aria-label={`เพิ่มงาน ${dayLabel.format(noon(day))}`}
                        className="inline-flex items-center gap-0.5 rounded-full border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft hover:border-operation hover:text-operation"
                      >
                        <Plus className="h-3 w-3" /> งาน
                      </button>
                    ) : null}
                  </span>
                </div>
                {dayJobs.map((job) => line(job, dayJobs))}
              </li>
            );
          })}
        </ol>
      ) : null}

      {outside.length ? (
        <div className="grid gap-1 rounded-xl border border-amber-200 bg-amber-50/60 px-2.5 py-1.5">
          <p className="text-[11px] font-semibold text-amber-900">นอกช่วงภารกิจหลักหรือยังไม่ระบุวัน</p>
          {outside.map((job) => line(job, outside))}
        </div>
      ) : null}

      {!jobs.length && !listed.length ? <p className="text-[12px] text-ink-soft">ยังไม่มีงานย่อย เพิ่มได้ที่ “ขั้นที่ 2”</p> : null}
    </section>
  );
}

function JobLine({
  job,
  position,
  urgent,
  onUrgent,
  onUp,
  onDown
}: {
  job: ScheduleJob;
  position: number;
  urgent: boolean;
  onUrgent?: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-1.5 rounded-lg text-[12px] ${urgent ? "bg-amber-50 ring-1 ring-amber-200" : ""}`}>
      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-slate-100 text-[9px] font-bold text-ink-soft">{position}</span>
      <span className="shrink-0 font-semibold tabular-nums text-ink">{job.time}</span>
      <span className="min-w-0 flex-1 truncate text-ink-soft" title={job.route}>
        {job.route}
      </span>
      {onUrgent ? (
        <button
          type="button"
          onClick={onUrgent}
          aria-pressed={urgent}
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${urgent ? "bg-amber-500 text-white" : "border border-slate-200 text-ink-faint hover:text-amber-700"}`}
        >
          ด่วน
        </button>
      ) : null}
      <JobStatusChip status={job.status} />
      {onUp || onDown ? (
        <span className="flex shrink-0 flex-col">
          <button type="button" onClick={onUp} disabled={!onUp} aria-label="เลื่อนขึ้น" className="text-ink-faint hover:text-operation disabled:opacity-20">
            <ArrowUp className="h-3 w-3" />
          </button>
          <button type="button" onClick={onDown} disabled={!onDown} aria-label="เลื่อนลง" className="text-ink-faint hover:text-operation disabled:opacity-20">
            <ArrowDown className="h-3 w-3" />
          </button>
        </span>
      ) : null}
    </div>
  );
}
