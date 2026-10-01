import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/rbac";
import { bangkokToday, getDayClose } from "@/lib/data/day-close";
import { getProjectByCode } from "@/lib/data/projects";
import { DutyAdjustDialog } from "@/components/day-close/duty-adjust-dialog";
import { timeOnDay } from "@/lib/export/day-close-workbook";

const money = (value: number | null | undefined) => (value == null ? "—" : value.toLocaleString("th-TH", { maximumFractionDigits: 2 }));
const hours = (value: number | null | undefined) => (value == null ? "—" : value.toLocaleString("th-TH", { maximumFractionDigits: 2 }));

function shiftDate(date: string, days: number) {
  const at = new Date(`${date}T12:00:00+07:00`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

export default async function DayClosePage({ params, searchParams }: { params: Promise<{ projectCode: string }>; searchParams?: Promise<{ date?: string }> }) {
  const { projectCode } = await params;
  const viewer = await getCurrentUserProfile();
  if (!viewer.authUserId && !viewer.isDevelopmentFallback) redirect("/login");
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();
  const permission = await requirePermission(project.id, "assignment.read");
  if (!permission.allowed) notFound();
  const canAdjust = (await requirePermission(project.id, "mission.create")).allowed;

  const query = searchParams ? await searchParams : {};
  const today = bangkokToday();
  const date = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : today;
  const { rows, totals, loadError } = await getDayClose(project.id, date);
  const base = `/projects/${projectCode}/ground-transfer/day-close`;
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
          <a
            href={`${base}/export?date=${date}`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-command bg-operation px-3.5 text-[13px] font-semibold text-white shadow-sm"
          >
            <Download className="h-4 w-4" /> ดาวน์โหลด Excel
          </a>
        }
      />

      <form method="get" className="flex flex-wrap items-center gap-2">
        <a href={`${base}?date=${shiftDate(date, -1)}`} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
          ← วันก่อน
        </a>
        <input type="date" name="date" defaultValue={date} className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm" />
        <button type="submit" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
          ดูวันนี้
        </button>
        <a href={`${base}?date=${shiftDate(date, 1)}`} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
          วันถัดไป →
        </a>
        {date !== today ? (
          <a href={base} className="text-xs font-semibold text-operation hover:underline">
            กลับมาวันนี้
          </a>
        ) : null}
      </form>

      {loadError ? <DataUnavailable description="โหลดข้อมูลบางส่วนไม่สำเร็จ" detail={loadError} /> : null}

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="หน่วยที่มีงาน" value={`${totals.units}`} />
        <Metric label="งานเสร็จ" value={`${totals.jobsDone} / ${totals.jobs}`} />
        <Metric label="ชั่วโมงที่คิด" value={hours(totals.hours)} />
        <Metric label="OT" value={`${hours(totals.overtimeHours)} ชม. · ${money(totals.overtimeAmount)} บ.`} tone={totals.overtimeHours ? "warning" : undefined} />
        <Metric label="ยอดรวมโดยประมาณ" value={`${money(totals.total)} บ.`} tone="strong" />
      </section>
      {totals.unpriced ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">{totals.unpriced} หน่วยยังไม่มีอัตราค่าบริการที่รถ — ไม่รวมในยอด</p>
      ) : null}

      {rows.length ? (
        <div className="overflow-x-auto rounded-panel border border-border bg-white shadow-sm">
          <table className="w-full min-w-[64rem] text-left text-[13px]">
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
            <tbody>
              {rows.map((row) => (
                <tr key={row.unitId} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <span className="font-semibold text-ink">{row.label}</span>
                    <span className="block text-[11px] text-slate-500">
                      {[row.driverName, row.plate].filter(Boolean).join(" · ") || "—"}
                    </span>
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
                          projectId={project.id}
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

function Metric({ label, value, tone }: { label: string; value: string; tone?: "warning" | "strong" }) {
  return (
    <div className={`rounded-panel border px-3 py-2 ${tone === "warning" ? "border-amber-200 bg-amber-50" : tone === "strong" ? "border-teal-200 bg-teal-50" : "border-border bg-white"}`}>
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className={`text-base font-bold tabular-nums ${tone === "warning" ? "text-amber-900" : "text-ink"}`}>{value}</p>
    </div>
  );
}
