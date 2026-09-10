"use client";

import { useId } from "react";
import { CalendarDays, Clock } from "lucide-react";

// Native date inputs render in the browser's locale, so the same value reads as
// 09/10 or 10/09 depending on the machine — and an operator scheduling a convoy
// has no way to tell which they typed. Every field here echoes the value back in
// Thai, and ranges show their own duration, so a mistake is visible at the point
// of entry rather than when a driver arrives on the wrong day.

const TH_DATE = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const TH_DATETIME = new Intl.DateTimeFormat("th-TH", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

/** Today in the viewer's own timezone, as the value a date input expects. */
export function todayLocalDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** Now, rounded down to the minute, as a datetime-local value. */
export function nowLocalDateTime(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

function parse(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function describeThai(value: string, withTime: boolean): string {
  const date = parse(value);
  if (!date) return "";
  return withTime ? `${TH_DATETIME.format(date)} น.` : TH_DATE.format(date);
}

/** "4 ชม. 30 นาที", or "" when the pair is incomplete or backwards. */
export function describeDuration(start: string, end: string): string {
  // "09:30" alone is not a date; anchor both to the same day so the difference
  // is still meaningful for a time-only range.
  const anchor = (value: string) => (/^\d{2}:\d{2}$/.test(value) ? `2000-01-01T${value}` : value);
  const from = parse(anchor(start));
  const to = parse(anchor(end));
  if (!from || !to) return "";
  const minutes = Math.round((to.getTime() - from.getTime()) / 60000);
  if (minutes <= 0) return "";
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  return [days ? `${days} วัน` : "", hours ? `${hours} ชม.` : "", mins ? `${mins} นาที` : ""].filter(Boolean).join(" ");
}

export function isBackwards(start: string, end: string): boolean {
  const from = parse(start);
  const to = parse(end);
  return Boolean(from && to && to.getTime() < from.getTime());
}

interface FieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
  hint?: string;
  /** Time inside a day already chosen elsewhere — shows a time picker, not a date. */
  timeOnly?: boolean;
}

export function DateTimeField({ label, name, value, onChange, withTime = false, required, min, max, hint, timeOnly }: FieldProps) {
  const id = useId();
  const echo = timeOnly ? (value ? `${value} น.` : "") : describeThai(value, withTime);
  const Icon = withTime || timeOnly ? Clock : CalendarDays;

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        {label}
        {required ? <span className="text-rose-500">*</span> : <span className="font-normal text-slate-400">(ไม่บังคับ)</span>}
      </label>
      <input
        id={id}
        name={name}
        type={timeOnly ? "time" : withTime ? "datetime-local" : "date"}
        value={value}
        min={min}
        max={max}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-operation focus:ring-4 focus:ring-teal-50"
      />
      {/* The echo is the point: it is what the operator checks, not the input. */}
      <p className={`min-h-4 text-[11px] leading-4 ${echo ? "font-semibold text-operation" : "text-slate-400"}`}>
        {echo || hint || "ยังไม่ได้เลือก"}
      </p>
    </div>
  );
}

/**
 * A start/end pair. Beyond the two fields it answers the question the operator
 * actually has — how long is this — and refuses to stay silent when the end is
 * before the start.
 */
export function DateRangeFields({
  legend,
  startLabel = "เริ่ม",
  endLabel = "สิ้นสุด",
  startName,
  endName,
  start,
  end,
  onStart,
  onEnd,
  withTime = false,
  required,
  timeOnly = false,
  min
}: {
  legend?: string;
  startLabel?: string;
  endLabel?: string;
  startName: string;
  endName: string;
  start: string;
  end: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  withTime?: boolean;
  required?: boolean;
  /** Both ends are times within one already-chosen day. */
  timeOnly?: boolean;
  /** Refuse anything before this; defaults to now for datetime ranges. */
  min?: string;
}) {
  const duration = describeDuration(start, end);
  const backwards = isBackwards(start, end);

  return (
    <fieldset className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
      {legend ? <legend className="px-1 text-xs font-bold text-slate-600">{legend}</legend> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <DateTimeField
          label={startLabel}
          name={startName}
          value={start}
          onChange={onStart}
          withTime={withTime}
          timeOnly={timeOnly}
          required={required}
          min={min}
        />
        <DateTimeField
          label={endLabel}
          name={endName}
          value={end}
          onChange={onEnd}
          withTime={withTime}
          timeOnly={timeOnly}
          required={required}
          // The browser stops the impossible case before the form does.
          min={start || min || undefined}
        />
      </div>
      {backwards ? (
        <p className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[12px] font-semibold text-rose-700">
          เวลาสิ้นสุดอยู่ก่อนเวลาเริ่ม กรุณาตรวจสอบอีกครั้ง
        </p>
      ) : duration ? (
        <p className="rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink-soft">รวม {duration}</p>
      ) : null}
    </fieldset>
  );
}
