"use client";

import { Clock3, RotateCcw } from "lucide-react";
import { daysBetween, dutyLengthHours, type DutyHours, type DutySchedule } from "@/lib/domain/duty-hours";

const dayLabel = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
const MAX_LISTED_DAYS = 62;

function hoursLabel(hours: DutyHours) {
  const length = dutyLengthHours(hours);
  return `${length.toLocaleString("th-TH")} ชม.${hours.end <= hours.start ? " (ถึงเช้าวันถัดไป)" : ""}`;
}

/**
 * Clock-in and clock-out for every day of a main job: one default, and any day
 * can differ. Overtime is measured against these (lib/domain/duty-hours.ts).
 */
export function DutyHoursFields({
  from,
  to,
  defaults,
  overrides,
  onDefaults,
  onOverrides
}: {
  from: string;
  to: string;
  defaults: DutyHours;
  overrides: DutySchedule;
  onDefaults: (hours: DutyHours) => void;
  onOverrides: (schedule: DutySchedule) => void;
}) {
  const days = from ? daysBetween(from, to || from) : [];
  const setDay = (day: string, patch: Partial<DutyHours>) => onOverrides({ ...overrides, [day]: { ...(overrides[day] ?? defaults), ...patch } });
  const resetDay = (day: string) => {
    const next = { ...overrides };
    delete next[day];
    onOverrides(next);
  };

  return (
    <fieldset className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold text-ink">
        <Clock3 className="h-4 w-4 text-operation" /> เวลาเข้า-ออกงานของรถ <span className="field-required-badge">*</span>
      </legend>
      <p className="text-xs text-ink-soft">ใช้คิด OT: เข้าก่อนเวลาไม่นับ · ออกหลังเวลาออกงานนับเป็น OT ทุกนาที</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs font-semibold text-slate-700">
          เข้างาน (ทุกวัน)
          <input type="time" required value={defaults.start} onChange={(event) => onDefaults({ ...defaults, start: event.target.value })} className="field-input h-10 w-32" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700">
          ออกงาน (ทุกวัน)
          <input type="time" required value={defaults.end} onChange={(event) => onDefaults({ ...defaults, end: event.target.value })} className="field-input h-10 w-32" />
        </label>
        {defaults.start && defaults.end ? <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-operation">{hoursLabel(defaults)}</span> : null}
      </div>

      {days.length > 1 && days.length <= MAX_LISTED_DAYS ? (
        <details className="rounded-xl border border-slate-200 bg-slate-50/60 p-2" open={Object.keys(overrides).length > 0}>
          <summary className="cursor-pointer text-xs font-semibold text-slate-600">
            ปรับเวลาเป็นรายวัน ({days.length} วัน{Object.keys(overrides).length ? ` · ปรับแล้ว ${Object.keys(overrides).length} วัน` : ""})
          </summary>
          <ol className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {days.map((day) => {
              const hours = overrides[day] ?? defaults;
              const changed = Boolean(overrides[day]);
              return (
                <li key={day} className={`flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs ${changed ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
                  <span className="w-24 shrink-0 font-semibold text-ink">{dayLabel.format(new Date(`${day}T12:00:00+07:00`))}</span>
                  <input type="time" value={hours.start} onChange={(event) => setDay(day, { start: event.target.value })} className="h-8 rounded-md border border-slate-300 px-1.5" aria-label={`เข้างาน ${day}`} />
                  <span>–</span>
                  <input type="time" value={hours.end} onChange={(event) => setDay(day, { end: event.target.value })} className="h-8 rounded-md border border-slate-300 px-1.5" aria-label={`ออกงาน ${day}`} />
                  {changed ? (
                    <button type="button" onClick={() => resetDay(day)} title="ใช้เวลาเดียวกับทุกวัน" className="text-amber-800 hover:text-ink">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </details>
      ) : null}
    </fieldset>
  );
}
