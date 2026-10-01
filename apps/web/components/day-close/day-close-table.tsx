import type { ReactNode } from "react";
import type { DayCloseRow, DayCloseTotals } from "@/lib/domain/day-close";
import { timeOnDay } from "@/lib/export/day-close-workbook";
import { DutyAdjustDialog } from "./duty-adjust-dialog";

// The day-close table, shared by the one-day view and the project view so a
// unit's day reads the same in both.

export const money = (value: number | null | undefined) => (value == null ? "—" : value.toLocaleString("th-TH", { maximumFractionDigits: 2 }));
export const hours = (value: number | null | undefined) => (value == null ? "—" : value.toLocaleString("th-TH", { maximumFractionDigits: 2 }));

export const DAY_CLOSE_COLUMNS = 10;

export function DayCloseHead() {
  return (
    <thead className="bg-slate-50 text-[11px] text-slate-500">
      <tr>
        <th className="px-3 py-2">Call Sign</th>
        <th className="px-3 py-2">งาน</th>
        <th className="px-3 py-2">เวลางาน · เลิกงาน</th>
        <th className="px-3 py-2">เข้า–ออกงาน</th>
        <th className="px-3 py-2 text-right">ชม. ที่คิด</th>
        <th className="px-3 py-2 text-right">OT</th>
        <th className="px-3 py-2 text-right">ค่าบริการ</th>
        <th className="px-3 py-2 text-right">ค่า OT</th>
        <th className="px-3 py-2 text-right">รวม</th>
        <th className="px-3 py-2">หมายเหตุ</th>
      </tr>
    </thead>
  );
}

export function DayCloseRowView({ row, date, projectId, canAdjust }: { row: DayCloseRow; date: string; projectId: string; canAdjust: boolean }) {
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-3 py-2">
        <span className="font-semibold text-ink">{row.label}</span>
        <span className="block text-[11px] text-slate-500">{[row.driverName, row.plate].filter(Boolean).join(" · ") || "—"}</span>
      </td>
      <td className="px-3 py-2 tabular-nums">
        {row.jobsDone}/{row.jobs}
      </td>
      <td className="px-3 py-2 tabular-nums">
        {timeOnDay(row.cost.dutyStart, date)}–{timeOnDay(row.cost.scheduledEnd, date)}
        {row.cost.source === "sub_jobs" ? <span className="block text-[10px] text-amber-700">ตามงานย่อย</span> : null}
        {row.cost.endBasis !== "scheduled" ? (
          <span className={`block text-[11px] font-semibold ${row.cost.endBasis === "adjusted" ? "text-route" : "text-amber-800"}`}>
            เลิกงาน {timeOnDay(row.cost.dutyEnd, date)} {row.cost.endBasis === "adjusted" ? "(ศูนย์แก้)" : "(เข้าช้า)"}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 tabular-nums">
        {row.clockIn ? timeOnDay(row.clockIn, date) : "—"}–{row.clockOut ? timeOnDay(row.clockOut, date) : "—"}
        {row.cost.clockOutAdjusted ? <span className="block text-[10px] font-semibold text-route">ออกงาน: ศูนย์แก้</span> : null}
        {canAdjust && !row.unitId.startsWith("job:") ? (
          <span className="block">
            <DutyAdjustDialog
              projectId={projectId}
              callSignId={row.unitId}
              date={date}
              label={row.label}
              computedEnd={row.cost.computedEnd}
              scheduledEnd={row.cost.scheduledEnd}
              dutyEnd={row.cost.dutyEnd}
              recordedClockOut={row.cost.recordedClockOut}
              clockOut={row.cost.clockOut}
              adjusted={Boolean(row.adjustment)}
              reason={row.adjustment?.reason ?? null}
            />
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{hours(row.cost.scheduledHours + row.cost.overtimeHours)}</td>
      <td className={`px-3 py-2 text-right tabular-nums ${row.cost.overtimeHours ? "font-semibold text-amber-800" : "text-slate-400"}`}>
        {row.cost.overtimeHours ? hours(row.cost.overtimeHours) : "—"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{money(row.cost.baseAmount)}</td>
      <td className={`px-3 py-2 text-right tabular-nums ${row.cost.overtimeAmount ? "text-amber-800" : "text-slate-400"}`}>
        {row.cost.overtimeAmount ? money(row.cost.overtimeAmount) : "—"}
      </td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(row.cost.total)}</td>
      <td className="px-3 py-2 text-[11px] text-slate-600">{row.notes.length ? row.notes.join(" · ") : <span className="text-emerald-700">ครบ</span>}</td>
    </tr>
  );
}

export function DayCloseMetrics({ totals, lead }: { totals: DayCloseTotals; lead?: ReactNode }) {
  return (
    <>
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {lead ?? <Metric label="หน่วยที่มีงาน" value={`${totals.units}`} />}
        <Metric label="งานเสร็จ" value={`${totals.jobsDone} / ${totals.jobs}`} />
        <Metric label="ชั่วโมงที่คิด" value={hours(totals.hours)} />
        <Metric label="OT" value={`${hours(totals.overtimeHours)} ชม. · ${money(totals.overtimeAmount)} บ.`} tone={totals.overtimeHours ? "warning" : undefined} />
        <Metric label="ยอดรวมโดยประมาณ" value={`${money(totals.total)} บ.`} tone="strong" />
      </section>
      {totals.unpriced ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">{totals.unpriced} รายการยังไม่มีอัตราค่าบริการที่รถ — ไม่รวมในยอด</p>
      ) : null}
    </>
  );
}

export function Metric({ label, value, tone }: { label: string; value: string; tone?: "warning" | "strong" }) {
  return (
    <div className={`rounded-panel border px-3 py-2 ${tone === "warning" ? "border-amber-200 bg-amber-50" : tone === "strong" ? "border-teal-200 bg-teal-50" : "border-border bg-white"}`}>
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className={`text-base font-bold tabular-nums ${tone === "warning" ? "text-amber-900" : "text-ink"}`}>{value}</p>
    </div>
  );
}
