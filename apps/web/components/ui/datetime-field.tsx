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

function calendarDayIndex(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10));
  if (!match) return null;
  const [, year, month, day] = match;
  return Math.floor(Date.UTC(Number(year), Number(month) - 1, Number(day)) / (24 * 60 * 60 * 1000));
}

/** "4 ชม. 30 นาที", or "" when the pair is incomplete or backwards. */
export function describeDuration(start: string, end: string, options: { dateOnly?: boolean } = {}): string {
  if (options.dateOnly) {
    const fromDay = calendarDayIndex(start);
    const toDay = calendarDayIndex(end);
    if (fromDay == null || toDay == null) return "";
    const days = toDay - fromDay + 1;
    if (days <= 0) return "";
    return `${days} วัน`;
  }

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
    <div className="grid gap-3">
      <div className="flex items-center justify-between rounded-xl bg-canvas px-1.5 py-1">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint transition hover:bg-white hover:text-operation hover:shadow-sm focus-ring"
          aria-label="เดือนก่อนหน้า"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-center text-[13px] font-semibold leading-5 text-ink">
          {TH_MONTHS[view.month]} {view.year + 543}
        </span>
        <button
          type="button"
          onClick={() => shift(1)}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint transition hover:bg-white hover:text-operation hover:shadow-sm focus-ring"
          aria-label="เดือนถัดไป"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {TH_WEEKDAYS.map((day) => (
          <span key={day} className="grid h-7 place-items-center text-[10px] font-semibold text-ink-faint">
            {day}
          </span>
        ))}
        {cells.map((date, index) => {
          if (!date) return <span key={`pad-${index}`} className="h-9" />;
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
              className={`grid h-9 min-w-0 place-items-center rounded-xl text-[12px] font-semibold transition focus-ring ${
                isSelected
                  ? "bg-operation text-white shadow-[0_10px_22px_rgba(8,123,115,0.24)]"
                  : isBlocked
                    ? "cursor-not-allowed bg-slate-50 text-slate-300 line-through"
                    : isToday
                      ? "bg-operation-soft text-operation ring-1 ring-inset ring-operation/20 hover:bg-operation-soft/80"
                      : "text-ink-soft hover:bg-canvas hover:text-ink"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

/** "7:05", "0705", "07.05" → "07:05"; anything that is not a real clock time → null. */
function parseTypedTime(input: string): string | null {
  const match = /^(\d{1,2})[:.]?(\d{2})$/.exec(input.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// Sets a clock time — "starts at / ends at" — so it reads like a clock face: every
// hour and every 5 minutes visible at once, one tap each. It used to be −/+
// steppers with a mouse-wheel counter, which looked and behaved like a countdown
// timer. Minutes off the 5-minute grid are typed in the box at the top.
function TimeGrid({ value, onPick }: { value: string; onPick: (time: string) => void }) {
  const [hour, minute] = value ? value.split(":") : ["", ""];
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commitDraft = () => {
    const time = parseTypedTime(draft);
    if (time) {
      if (time !== value) onPick(time);
    } else {
      setDraft(value);
    }
  };

  // Escape and outside clicks close the popover by unmounting this grid, and the
  // input never blurs on the way out — so a typed time is saved here instead.
  const pending = useRef({ draft, value, onPick });
  pending.current = { draft, value, onPick };
  useEffect(
    () => () => {
      const { draft: typed, value: saved, onPick: save } = pending.current;
      const time = parseTypedTime(typed);
      if (time && time !== saved) save(time);
    },
    []
  );

  const cell = (selected: boolean) =>
    `grid h-8 place-items-center rounded-lg text-[13px] font-semibold tabular-nums transition focus-ring ${
      selected ? "bg-operation text-white shadow-sm" : "text-ink-soft hover:bg-operation-soft hover:text-operation"
    }`;

  return (
    <div className="grid gap-2.5">
      <label className="grid gap-1">
        <span className="text-[11px] font-semibold text-ink-faint">พิมพ์เวลา</span>
        <input
          aria-label="พิมพ์เวลา"
          className="h-9 rounded-xl border border-border bg-white px-3 text-[14px] font-semibold tabular-nums text-ink outline-none focus:border-operation focus:ring-4 focus:ring-operation/10"
          inputMode="numeric"
          placeholder="เช่น 09:30"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
          }}
        />
      </label>
      <div className="grid gap-1">
        <span className="text-[11px] font-semibold text-ink-faint">ชั่วโมง</span>
        <div className="grid grid-cols-6 gap-1">
          {HOURS.map((option) => (
            <button key={option} type="button" aria-label={`${option} นาฬิกา`} className={cell(option === hour)} onClick={() => onPick(`${option}:${minute || "00"}`)}>
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-1">
        <span className="text-[11px] font-semibold text-ink-faint">นาที</span>
        <div className="grid grid-cols-6 gap-1">
          {MINUTES.map((option) => (
            <button key={option} type="button" aria-label={`${option} นาที`} className={cell(option === minute)} onClick={() => onPick(`${hour || "00"}:${option}`)}>
              :{option}
            </button>
          ))}
        </div>
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
  const [alignRight, setAlignRight] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const wide = withTime && !timeOnly;
  // One source for the popover width: the class below and the fit check in toggle().
  const popoverRem = wide ? 38 : 20;

  function toggle() {
    if (!open && ref.current) {
      // Opened from a right-hand column, a left-anchored popover runs off the
      // screen. Anchor it to the field's right edge instead, when that fits.
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const width = Math.min(popoverRem * rem, window.innerWidth - 2 * rem);
      const field = ref.current.getBoundingClientRect();
      setAlignRight(field.left + width > window.innerWidth - rem && field.right - width >= rem);
    }
    setOpen((current) => !current);
  }

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
      <label htmlFor={id} className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-ink-soft">
        <Icon className="h-3.5 w-3.5 shrink-0 text-operation" />
        {label}
        {required ? <span className="text-danger">*</span> : <span className="font-normal text-ink-faint">(ไม่บังคับ)</span>}
      </label>

      {/* The real field, kept for anything that reads the form by name. */}
      <input type="hidden" name={name} value={value} />

      <div className="relative">
        <button
          id={id}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={`flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 text-left text-[14px] shadow-sm transition focus-ring ${
            open
              ? "border-operation bg-white ring-4 ring-operation/10"
              : value
                ? "border-border bg-white text-ink hover:border-operation/45"
                : "border-dashed border-border bg-canvas/70 text-ink-faint hover:border-operation/45 hover:bg-white"
          }`}
        >
          <span className={`truncate font-semibold ${value ? "text-ink" : "text-slate-400"}`}>
            {echo || (timeOnly ? "เลือกเวลา" : "เลือกวันที่")}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-ink-faint transition ${open ? "rotate-180 text-operation" : ""}`} />
        </button>

        {open ? (
          // Date and time sit side by side when there is room: stacked, the pair
          // was ~670px tall and ran off the bottom of a laptop screen.
          <div className={`absolute top-[calc(100%+8px)] z-50 rounded-[18px] border border-border/90 bg-white/95 p-3.5 shadow-[0_24px_70px_rgba(16,32,51,0.16)] backdrop-blur ${
            alignRight ? "right-0" : "left-0"
          }`}
          style={{ width: `min(${popoverRem}rem, calc(100vw - 2rem))` }}>
            {timeOnly ? (
              <TimeGrid value={value} onPick={pickTime} />
            ) : (
              <div className={`grid gap-3 ${withTime ? "sm:grid-cols-2 sm:gap-4" : ""}`}>
                <CalendarGrid selected={datePart(value)} min={min} max={max} onPick={pickDate} />
                {withTime ? (
                  <div className="border-t border-slate-100 pt-2 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                    <TimeGrid value={timePart(value)} onPick={pickTime} />
                  </div>
                ) : null}
              </div>
            )}
            {withTime || timeOnly ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-operation text-[13px] font-semibold text-white shadow-[0_12px_28px_rgba(8,123,115,0.22)] transition hover:bg-operation-deep focus-ring"
              >
                <Check className="h-3.5 w-3.5" /> เสร็จสิ้น
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* The echo is the point: it is what the operator checks, not the control. */}
      <p className={`min-h-4 text-[11px] leading-4 ${echo ? "font-semibold text-operation" : "text-ink-faint"}`}>
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
  min,
  max
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
  max?: string;
}) {
  const duration = describeDuration(start, end, { dateOnly: !withTime && !timeOnly });
  const backwards = isBackwards(start, end);

  return (
    <fieldset className="grid gap-3 rounded-2xl border border-border/80 bg-gradient-to-b from-white to-canvas/45 p-3 shadow-sm">
      {legend ? <legend className="px-1 text-xs font-semibold text-ink-soft">{legend}</legend> : null}
      {/* The summary keeps its own column, reserved whether or not there is
          anything to say. Letting it wrap underneath meant the whole form
          jumped a line the moment a second date was chosen. */}
      <div className="grid gap-3 sm:grid-cols-2 sm:items-start lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(9rem,auto)]">
        <DateTimeField
          label={startLabel}
          name={startName}
          value={start}
          onChange={onStart}
          withTime={withTime}
          timeOnly={timeOnly}
          required={required}
          min={min}
          max={max}
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
          max={max}
        />
        <div className="min-h-[2.75rem] self-center lg:pt-5">
          {backwards ? (
            <p className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[12px] font-semibold leading-4 text-rose-700">
              วันสิ้นสุดอยู่ก่อนวันเริ่ม กรุณาตรวจสอบ
            </p>
          ) : duration ? (
            <p className="w-fit rounded-full bg-operation-soft px-3 py-1 text-[12px] font-semibold text-operation ring-1 ring-inset ring-operation/15">
              รวม {duration}
            </p>
          ) : (
            <p className="text-[11px] leading-4 text-ink-faint">เลือกครบทั้งสองช่องเพื่อดูจำนวนวัน</p>
          )}
        </div>
      </div>
    </fieldset>
  );
}
