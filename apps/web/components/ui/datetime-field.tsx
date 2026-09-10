"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock } from "lucide-react";

// A native date input cannot be restyled past its border: the calendar it opens
// belongs to the browser, renders in the machine's locale, and shows Gregorian
// years to operators who think in พ.ศ. So the control is ours — a Thai month
// grid with Buddhist years, days outside the allowed range visibly dead rather
// than silently rejected, and the chosen value echoed in full underneath.
//
// The real input is still there, hidden, so anything reading the form by field
// name keeps working.

const TH_DATE = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const TH_DATETIME = new Intl.DateTimeFormat("th-TH", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];
const TH_WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
/** Times an operation actually starts at, so the common case is one tap. */
const TIME_PRESETS = ["06:00", "07:00", "08:00", "09:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];

export function todayLocalDate(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function nowLocalDateTime(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
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
  const anchor = (value: string) => (/^\d{2}:\d{2}$/.test(value) ? `2000-01-01T${value}` : value);
  const from = parse(anchor(start));
  const to = parse(anchor(end));
  return Boolean(from && to && to.getTime() < from.getTime());
}

const datePart = (value: string) => value.slice(0, 10);
const timePart = (value: string) => (value.length >= 16 ? value.slice(11, 16) : "");
const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

function buildMonth(year: number, month: number) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = first.getDay();
  const cells: Array<string | null> = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(iso(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function CalendarGrid({
  selected, min, max, onPick
}: {
  selected: string;
  min?: string;
  max?: string;
  onPick: (date: string) => void;
}) {
  const today = todayLocalDate();
  const anchor = parse(selected || min || today) ?? new Date();
  const [view, setView] = useState({ year: anchor.getFullYear(), month: anchor.getMonth() });
  const cells = useMemo(() => buildMonth(view.year, view.month), [view]);

  const blocked = (date: string) => Boolean((min && date < min) || (max && date > max));
  const shift = (by: number) => {
    const next = new Date(view.year, view.month + by, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100"
          aria-label="เดือนก่อนหน้า"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[13px] font-bold text-ink">
          {TH_MONTHS[view.month]} {view.year + 543}
        </span>
        <button
          type="button"
          onClick={() => shift(1)}
          className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100"
          aria-label="เดือนถัดไป"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {TH_WEEKDAYS.map((day) => (
          <span key={day} className="grid h-6 place-items-center text-[10px] font-bold text-slate-400">
            {day}
          </span>
        ))}
        {cells.map((date, index) => {
          if (!date) return <span key={`pad-${index}`} />;
          const day = Number(date.slice(8, 10));
          const isSelected = date === selected;
          const isToday = date === today;
          const isBlocked = blocked(date);
          return (
            <button
              key={date}
              type="button"
              disabled={isBlocked}
              onClick={() => onPick(date)}
              className={`grid h-8 place-items-center rounded-lg text-[12px] font-semibold transition ${
                isSelected
                  ? "bg-operation text-white shadow-sm"
                  : isBlocked
                    ? "cursor-not-allowed text-slate-300 line-through"
                    : isToday
                      ? "bg-teal-50 text-operation ring-1 ring-inset ring-teal-200 hover:bg-teal-100"
                      : "text-ink-soft hover:bg-slate-100"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1 border-t border-slate-100 pt-2">
        {[
          { label: "วันนี้", offset: 0 },
          { label: "พรุ่งนี้", offset: 1 },
          { label: "มะรืนนี้", offset: 2 }
        ].map(({ label, offset }) => {
          const base = new Date();
          base.setDate(base.getDate() + offset);
          const value = iso(base.getFullYear(), base.getMonth(), base.getDate());
          if (blocked(value)) return null;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onPick(value)}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-ink-soft transition hover:bg-slate-200"
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimeGrid({ value, onPick }: { value: string; onPick: (time: string) => void }) {
  const [hour, minute] = value ? value.split(":") : ["", ""];

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1">
        {TIME_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onPick(preset)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              value === preset ? "bg-operation text-white" : "bg-slate-100 text-ink-soft hover:bg-slate-200"
            }`}
          >
            {preset}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
        <span className="text-[11px] font-semibold text-slate-500">กำหนดเอง</span>
        <select
          className="rounded-lg border border-slate-300 px-2 py-1 text-[12px] font-semibold text-ink"
          value={hour}
          onChange={(event) => onPick(`${event.target.value}:${minute || "00"}`)}
        >
          <option value="">ชม.</option>
          {Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0")).map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="font-bold text-slate-400">:</span>
        <select
          className="rounded-lg border border-slate-300 px-2 py-1 text-[12px] font-semibold text-ink"
          value={minute}
          onChange={(event) => onPick(`${hour || "00"}:${event.target.value}`)}
        >
          <option value="">นาที</option>
          {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
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
  /** Time inside a day already chosen elsewhere — shows a clock, not a calendar. */
  timeOnly?: boolean;
}

export function DateTimeField({ label, name, value, onChange, withTime = false, required, min, max, hint, timeOnly }: FieldProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  const echo = timeOnly ? (value ? `${value} น.` : "") : describeThai(value, withTime);
  const Icon = withTime || timeOnly ? Clock : CalendarDays;

  function pickDate(date: string) {
    if (withTime) {
      onChange(`${date}T${timePart(value) || "09:00"}`);
      return;
    }
    onChange(date);
    setOpen(false);
  }

  function pickTime(time: string) {
    if (timeOnly) {
      onChange(time);
      return;
    }
    onChange(`${datePart(value) || todayLocalDate()}T${time}`);
  }

  return (
    <div className="grid gap-1.5" ref={ref}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        {label}
        {required ? <span className="text-rose-500">*</span> : <span className="font-normal text-slate-400">(ไม่บังคับ)</span>}
      </label>

      {/* The real field, kept for anything that reads the form by name. */}
      <input type="hidden" name={name} value={value} />

      <div className="relative">
        <button
          id={id}
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
            open
              ? "border-operation bg-white ring-4 ring-teal-50"
              : value
                ? "border-slate-300 bg-white text-ink hover:border-slate-400"
                : "border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-slate-400"
          }`}
        >
          <span className={`truncate font-semibold ${value ? "text-ink" : "text-slate-400"}`}>
            {echo || (timeOnly ? "เลือกเวลา" : "เลือกวันที่")}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
        </button>

        {open ? (
          <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-[268px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
            {timeOnly ? (
              <TimeGrid value={value} onPick={pickTime} />
            ) : (
              <div className="grid gap-3">
                <CalendarGrid selected={datePart(value)} min={min} max={max} onPick={pickDate} />
                {withTime ? (
                  <div className="border-t border-slate-100 pt-2">
                    <TimeGrid value={timePart(value)} onPick={pickTime} />
                  </div>
                ) : null}
              </div>
            )}
            {withTime || timeOnly ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-operation py-2 text-[12px] font-semibold text-white"
              >
                <Check className="h-3.5 w-3.5" /> เสร็จสิ้น
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* The echo is the point: it is what the operator checks, not the control. */}
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
  timeOnly?: boolean;
  min?: string;
}) {
  const duration = describeDuration(start, end);
  const backwards = isBackwards(start, end);

  return (
    <fieldset className="grid gap-2 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/80 to-white p-3">
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
          // Whichever is later: the range's own floor, or the chosen start.
          min={timeOnly ? min : (start ? datePart(start) : undefined) || min}
        />
      </div>
      {backwards ? (
        <p className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[12px] font-semibold text-rose-700">
          เวลาสิ้นสุดอยู่ก่อนเวลาเริ่ม กรุณาตรวจสอบอีกครั้ง
        </p>
      ) : duration ? (
        <p className="w-fit rounded-full bg-teal-50 px-3 py-1 text-[12px] font-semibold text-operation ring-1 ring-inset ring-teal-100">
          รวม {duration}
        </p>
      ) : null}
    </fieldset>
  );
}
