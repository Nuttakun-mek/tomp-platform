"use client";

import { Clock3 } from "lucide-react";
import { FieldHelp } from "@/components/ui/field-help";
import { daysBetween, dutyLengthHours, type DutyHours, type DutySchedule } from "@/lib/domain/duty-hours";

const dayLabel = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
const MAX_LISTED_DAYS = 62;

function hoursLabel(hours: DutyHours) {
  const length = dutyLengthHours(hours);
  return `${length.toLocaleString("th-TH")} ชม.${hours.end <= hours.start ? " (ถึงเช้าวันถัดไป)" : ""}`;
}

export type DutyMode = "same" | "per_day";

/**
 * Clock-in and clock-out for every day of a main job. The choice is explicit —
 * "the same every day" or "set each day" — so nobody wonders whether a hidden
 * per-day list overrides the times they can see. Overtime is measured against
 * these (lib/domain/duty-hours.ts); days can still be changed later on the
 * unit card when a plan changes.
 */
export function DutyHoursFields({
  from,
  to,
  mode,
  defaults,
  overrides,
  onMode,
  onDefaults,
  onOverrides
}: {
  from: string;
  to: string;
  mode: DutyMode;
  defaults: DutyHours;
  overrides: DutySchedule;
  onMode: (mode: DutyMode) => void;
  onDefaults: (hours: DutyHours) => void;
  onOverrides: (schedule: DutySchedule) => void;
}) {
  const days = from ? daysBetween(from, to || from) : [];
  const setDay = (day: string, patch: Partial<DutyHours>) => onOverrides({ ...overrides, [day]: { ...(overrides[day] ?? defaults), ...patch } });
  const choose = (next: DutyMode) => {
    // Switching to per-day starts every day from the common times.
    if (next === "per_day") onOverrides(Object.fromEntries(days.map((day) => [day, overrides[day] ?? defaults])));
    onMode(next);
  };

  return (
    <fieldset className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      {/* A plain heading, not a <legend>: the fieldset border ran through the legend text. */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink">
        <Clock3 className="h-4 w-4 text-operation" /> เวลาเข้า-ออกงานของรถ <span className="field-required-badge">*</span>
        <FieldHelp content="ใช้คิด OT: เข้าก่อนเวลาไม่นับ · ออกหลังเวลาออกงานนับเป็น OT ทุกนาที · แก้ภายหลังได้ที่การ์ด Call Sign ในหน้านี้" />
        {/* The choice sits on the heading row — one line fewer. */}
        <div role="radiogroup" aria-label="รูปแบบเวลาเข้า-ออก" className="ml-1 inline-flex w-fit rounded-full border border-slate-300 bg-slate-50 p-0.5 text-xs font-semibold">
          {(
            [
              ["same", "เหมือนกันทุกวัน"],
              ["per_day", `กำหนดแต่ละวัน${days.length > 1 ? ` (${days.length} วัน)` : ""}`]
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              disabled={value === "per_day" && days.length === 0}
              onClick={() => choose(value)}
              className={`rounded-full px-3 py-1 transition disabled:opacity-40 ${mode === value ? "bg-operation text-white shadow-sm" : "text-slate-600 hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "same" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            เข้างาน
            <input type="time" required value={defaults.start} onChange={(event) => onDefaults({ ...defaults, start: event.target.value })} className="field-input h-10 w-32" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            ออกงาน
            <input type="time" required value={defaults.end} onChange={(event) => onDefaults({ ...defaults, end: event.target.value })} className="field-input h-10 w-32" />
          </label>
          {defaults.start && defaults.end ? <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-operation">{hoursLabel(defaults)}</span> : null}
        </div>
      ) : days.length > MAX_LISTED_DAYS ? (
        <p className="text-xs text-amber-800">ช่วงยาวเกิน {MAX_LISTED_DAYS} วัน — ใช้ “เหมือนกันทุกวัน” แล้วแก้บางวันที่การ์ด Call Sign</p>
      ) : (
        <ol className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {days.map((day) => {
            const hours = overrides[day] ?? defaults;
            return (
              <li key={day} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1.5 text-xs">
                <span className="w-24 shrink-0 font-semibold text-ink">{dayLabel.format(new Date(`${day}T12:00:00+07:00`))}</span>
                <input type="time" value={hours.start} onChange={(event) => setDay(day, { start: event.target.value })} className="h-8 rounded-md border border-slate-300 px-1.5" aria-label={`เข้างาน ${day}`} />
                <span>–</span>
                <input type="time" value={hours.end} onChange={(event) => setDay(day, { end: event.target.value })} className="h-8 rounded-md border border-slate-300 px-1.5" aria-label={`ออกงาน ${day}`} />
                <span className="text-[10px] text-ink-faint">{hoursLabel(hours)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </fieldset>
  );
}
