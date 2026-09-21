function clockMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function serviceWindowHours(start: string, end: string) {
  const startMinutes = clockMinutes(start);
  const endMinutes = clockMinutes(end);
  if (startMinutes == null || endMinutes == null) return null;
  const duration = endMinutes >= startMinutes ? endMinutes - startMinutes : 24 * 60 - startMinutes + endMinutes;
  return Math.round((duration / 60) * 100) / 100;
}

export function ServiceTimeSummary({
  start,
  end,
  packageHours
}: {
  start: string;
  end: string;
  packageHours: string;
}) {
  const hours = serviceWindowHours(start, end);
  const included = Number(packageHours);
  const hasIncluded = Number.isFinite(included) && included > 0;
  const delta = hours != null && hasIncluded ? Math.round((hours - included) * 100) / 100 : null;

  return (
    <div className="rounded-2xl border border-teal-100 bg-teal-50/60 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-operation">เวลาตามช่วงที่เลือก</p>
      <p className="mt-1 text-sm font-bold text-ink">
        {hours == null ? "ยังคำนวณไม่ได้" : `${hours.toLocaleString("th-TH")} ชั่วโมง`}
      </p>
      {delta != null ? (
        <p className={`mt-0.5 text-xs font-semibold ${delta > 0 ? "text-amber-800" : "text-emerald-800"}`}>
          {delta > 0
            ? `มากกว่าชั่วโมงที่ครอบคลุม ${delta.toLocaleString("th-TH")} ชั่วโมง`
            : delta < 0
              ? `น้อยกว่าชั่วโมงที่ครอบคลุม ${Math.abs(delta).toLocaleString("th-TH")} ชั่วโมง`
              : "เท่ากับชั่วโมงที่ครอบคลุม"}
        </p>
      ) : null}
    </div>
  );
}
