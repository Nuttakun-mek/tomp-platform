import { Fragment } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download, Filter } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import { DAY_CLOSE_COLUMNS, DayCloseHead, DayCloseMetrics, DayCloseRowView, Metric, money, hours } from "@/components/day-close/day-close-table";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/rbac";
import { bangkokToday, getDayClose, getDayCloseRange, DAY_CLOSE_MAX_DAYS } from "@/lib/data/day-close";
import { getProjectByCode } from "@/lib/data/projects";
import { DAY_CLOSE_FLAGS, filterDayCloseDays, totalsOf, type DayCloseFlag } from "@/lib/domain/day-close";
import { dayCloseFilterQuery, parseDayCloseFilter } from "@/lib/domain/day-close-filter";
import { dayLabel } from "@/lib/export/day-close-workbook";

type Search = Record<string, string | string[] | undefined>;

function shiftDate(date: string, days: number) {
  const at = new Date(`${date}T12:00:00+07:00`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

const pill = "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600";

export default async function DayClosePage({ params, searchParams }: { params: Promise<{ projectCode: string }>; searchParams?: Promise<Search> }) {
  const { projectCode } = await params;
  const viewer = await getCurrentUserProfile();
  if (!viewer.authUserId && !viewer.isDevelopmentFallback) redirect("/login");
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();
  const permission = await requirePermission(project.id, "assignment.read");
  if (!permission.allowed) notFound();
  const canAdjust = (await requirePermission(project.id, "mission.create")).allowed;

  const query: Search = searchParams ? await searchParams : {};
  const today = bangkokToday();
  const base = `/projects/${projectCode}/ground-transfer/day-close`;
  const rangeView = query.view === "range";
  const tabs = (
    <nav aria-label="มุมมองสรุปปิดวัน" className="inline-flex w-fit rounded-full border border-slate-300 bg-white p-0.5 text-[13px] font-semibold">
      <Link href={base} className={`rounded-full px-3.5 py-1.5 ${rangeView ? "text-slate-600" : "bg-operation text-white"}`} aria-current={rangeView ? undefined : "page"}>
        รายวัน
      </Link>
      <Link href={`${base}?view=range`} className={`rounded-full px-3.5 py-1.5 ${rangeView ? "bg-operation text-white" : "text-slate-600"}`} aria-current={rangeView ? "page" : undefined}>
        ทั้งโครงการ
      </Link>
    </nav>
  );

  if (rangeView) {
    const fallback = {
      from: /^\d{4}-\d{2}-\d{2}$/.test(project.startDate ?? "") ? project.startDate : shiftDate(today, -29),
      to: /^\d{4}-\d{2}-\d{2}$/.test(project.endDate ?? "") ? project.endDate : today
    };
    const filter = parseDayCloseFilter(query, fallback);
    const range = await getDayCloseRange(project.id, filter.from, filter.to);
    const days = filterDayCloseDays(range.days, filter);
    const totals = totalsOf(days.flatMap((day) => day.rows));
    const filtered = filter.units.length > 0 || filter.flags.length > 0;
    const unitsInRange = new Set(range.days.flatMap((day) => day.rows.map((row) => row.unitId)));
    const unitOptions = range.units.filter((unit) => unitsInRange.has(unit.id) || filter.units.includes(unit.id));

    return (
      <div className="grid gap-4">
        <PageHeader
          eyebrow="สรุปปิดวัน · ทั้งโครงการ"
          title={`${dayLabel(filter.from)} – ${dayLabel(filter.to)}`}
          description={`${days.length} วันที่มีงาน${filtered ? " ตามตัวกรอง" : ""} · กดวันที่เพื่อดูรายวันและแก้เวลา`}
          actions={
            <a href={`${base}/export?${dayCloseFilterQuery(filter)}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-command bg-operation px-3.5 text-[13px] font-semibold text-white shadow-sm">
              <Download className="h-4 w-4" /> ดาวน์โหลด Excel (แยกแท็บตามวัน)
            </a>
          }
        />
        {tabs}

        <form method="get" className="grid gap-3 rounded-panel border border-border bg-white p-3 shadow-sm">
          <input type="hidden" name="view" value="range" />
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
              ตั้งแต่
              <input type="date" name="from" defaultValue={filter.from} className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm" />
            </label>
            <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
              ถึง
              <input type="date" name="to" defaultValue={filter.to} className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm" />
            </label>
            <details className="relative">
              <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700">
                Call Sign {filter.units.length ? `(${filter.units.length})` : "ทั้งหมด"}
              </summary>
              <div className="absolute z-20 mt-1 grid max-h-72 w-80 gap-0.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                {unitOptions.length ? (
                  unitOptions.map((unit) => (
                    <label key={unit.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-slate-50">
                      <input type="checkbox" name="unit" value={unit.id} defaultChecked={filter.units.includes(unit.id)} className="mt-0.5" />
                      <span>
                        <span className="font-semibold text-ink">{unit.label}</span>
                        <span className="block text-[11px] text-slate-500">{[unit.driverName, unit.plate].filter(Boolean).join(" · ") || "—"}</span>
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="px-2 py-1.5 text-[12px] text-slate-500">ยังไม่มีหน่วยที่มีงานในช่วงนี้</p>
                )}
              </div>
            </details>
            <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-operation px-3.5 text-[13px] font-semibold text-white">
              <Filter className="h-4 w-4" /> กรอง
            </button>
            {filtered ? (
              <Link href={`${base}?view=range&from=${filter.from}&to=${filter.to}`} className="text-xs font-semibold text-operation hover:underline">
                ล้างตัวกรอง
              </Link>
            ) : null}
          </div>
          <fieldset className="flex flex-wrap items-center gap-1.5">
            <legend className="sr-only">แสดงเฉพาะ</legend>
            <span className="text-[11px] font-semibold text-slate-500">แสดงเฉพาะ:</span>
            {(Object.entries(DAY_CLOSE_FLAGS) as Array<[DayCloseFlag, string]>).map(([flag, label]) => (
              <label key={flag} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[12px] text-slate-700 has-[:checked]:border-operation has-[:checked]:bg-operation-soft has-[:checked]:text-operation">
                <input type="checkbox" name="flag" value={flag} defaultChecked={filter.flags.includes(flag)} className="h-3.5 w-3.5" />
                {label}
              </label>
            ))}
          </fieldset>
        </form>

        {range.loadError ? <DataUnavailable description="โหลดข้อมูลบางส่วนไม่สำเร็จ" detail={range.loadError} /> : null}
        {range.truncated ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">แสดงได้ครั้งละ {DAY_CLOSE_MAX_DAYS} วัน — เลือกช่วงวันที่ให้สั้นลงเพื่อดูส่วนที่เหลือ</p>
        ) : null}

        <DayCloseMetrics totals={totals} lead={<Metric label="วันที่มีงาน · หน่วย-วัน" value={`${days.length} วัน · ${totals.units}`} />} />

        {days.length ? (
          <div className="overflow-x-auto rounded-panel border border-border bg-white shadow-sm">
            <table className="w-full min-w-[64rem] text-left text-[13px]">
              <DayCloseHead />
              <tbody>
                {days.map((day) => (
                  <Fragment key={day.date}>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td colSpan={DAY_CLOSE_COLUMNS} className="px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link href={`${base}?date=${day.date}`} className="text-[13px] font-bold text-operation hover:underline">
                            {dayLabel(day.date)}
                          </Link>
                          <span className="text-[12px] tabular-nums text-slate-600">
                            {day.totals.units} หน่วย · งาน {day.totals.jobsDone}/{day.totals.jobs} · {hours(day.totals.hours)} ชม.
                            {day.totals.overtimeHours ? <span className="font-semibold text-amber-800"> · OT {hours(day.totals.overtimeHours)} ชม.</span> : null}
                            <span className="font-semibold text-ink"> · {money(day.totals.total)} บ.</span>
                          </span>
                        </div>
                      </td>
                    </tr>
                    {day.rows.map((row) => (
                      <DayCloseRowView key={`${day.date}:${row.unitId}`} row={row} date={day.date} projectId={project.id} canAdjust={canAdjust} />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-panel border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            {filtered ? "ไม่มีรายการตามตัวกรองนี้" : "ไม่มีงานในช่วงวันที่นี้"}
          </p>
        )}
      </div>
    );
  }

  const date = typeof query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : today;
  const { rows, totals, loadError } = await getDayClose(project.id, date);
  const label = new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(
    new Date(`${date}T12:00:00+07:00`)
  );

  return (
    <div className="grid gap-4">
      <PageHeader
        eyebrow="สรุปปิดวัน"
        title={label}
        description={date === today ? "วันนี้ — คนขับที่ยังไม่บันทึกเวลาออกนับถึงตอนนี้" : undefined}
        actions={
          <a href={`${base}/export?date=${date}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-command bg-operation px-3.5 text-[13px] font-semibold text-white shadow-sm">
            <Download className="h-4 w-4" /> ดาวน์โหลด Excel
          </a>
        }
      />
      {tabs}

      <form method="get" className="flex flex-wrap items-center gap-2">
        <a href={`${base}?date=${shiftDate(date, -1)}`} className={pill}>
          ← วันก่อน
        </a>
        <input type="date" name="date" defaultValue={date} className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm" />
        <button type="submit" className={pill}>
          ดูวันนี้
        </button>
        <a href={`${base}?date=${shiftDate(date, 1)}`} className={pill}>
          วันถัดไป →
        </a>
        {date !== today ? (
          <a href={base} className="text-xs font-semibold text-operation hover:underline">
            กลับมาวันนี้
          </a>
        ) : null}
      </form>

      {loadError ? <DataUnavailable description="โหลดข้อมูลบางส่วนไม่สำเร็จ" detail={loadError} /> : null}

      <DayCloseMetrics totals={totals} />

      {rows.length ? (
        <div className="overflow-x-auto rounded-panel border border-border bg-white shadow-sm">
          <table className="w-full min-w-[64rem] text-left text-[13px]">
            <DayCloseHead />
            <tbody>
              {rows.map((row) => (
                <DayCloseRowView key={row.unitId} row={row} date={date} projectId={project.id} canAdjust={canAdjust} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-panel border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">ไม่มีงานในวันนี้</p>
      )}
    </div>
  );
}
