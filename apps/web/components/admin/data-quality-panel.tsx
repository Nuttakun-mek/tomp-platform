import type { DataQualityReport } from "@/lib/admin/data-quality";
import { PilotCleanupAction } from "./pilot-cleanup-action";

function severityStyle(severity: "warning" | "critical") {
  return severity === "critical" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900";
}

export function DataQualityPanel({ report }: { report: DataQualityReport }) {
  const criticalCount = report.issues.filter((issue) => issue.severity === "critical").length;
  const warningCount = report.issues.filter((issue) => issue.severity === "warning").length;

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 lg:grid-cols-4">
        <div className="enterprise-card p-5">
          <p className="text-sm font-semibold text-slate-500">สถานะเชื่อมต่อ</p>
          <p className={`mt-2 text-2xl font-semibold ${report.connected ? "text-emerald-700" : "text-red-700"}`}>
            {report.connected ? "เชื่อมต่อแล้ว" : "ยังไม่พร้อม"}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">โหมด: {report.mode}</p>
        </div>
        <div className="enterprise-card p-5">
          <p className="text-sm font-semibold text-slate-500">ปัญหาระดับวิกฤต</p>
          <p className="mt-2 text-2xl font-semibold text-red-700">{criticalCount}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">ควรแก้ก่อนให้ทีมทดสอบจริง</p>
        </div>
        <div className="enterprise-card p-5">
          <p className="text-sm font-semibold text-slate-500">รายการที่ต้องติดตาม</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">{warningCount}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">ยังทดสอบต่อได้แต่ควรรู้ข้อจำกัด</p>
        </div>
        <div className="enterprise-card p-5">
          <p className="text-sm font-semibold text-slate-500">เวลาตรวจล่าสุด</p>
          <p className="mt-2 text-lg font-semibold text-ink">{report.checkedAt}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">Asia/Bangkok</p>
        </div>
      </section>

      <section className="enterprise-card p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-operation">ตารางข้อมูลที่ตรวจ</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">ภาพรวมข้อมูล Production Pilot</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">อ่านอย่างเดียว</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(report.tableCounts).map(([label, count]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-600">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{count}</p>
            </div>
          ))}
        </div>
      </section>

      <PilotCleanupAction />

      <section className="enterprise-card p-5 lg:p-6">
        <div>
          <p className="text-sm font-semibold text-operation">รายการที่ต้องจัดการ</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">ผลตรวจคุณภาพข้อมูล</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            หน้านี้ไม่ลบหรือแก้ข้อมูลอัตโนมัติ เพื่อป้องกันความเสียหายกับข้อมูลจริง ให้ใช้เป็นรายงานก่อน cleanup ด้วยแผนที่ชัดเจน
          </p>
        </div>

        {report.issues.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
            <p className="font-semibold">ไม่พบปัญหาหลักในข้อมูลที่ตรวจ</p>
            <p className="mt-2 text-sm leading-6">พร้อมทดสอบ flow: สร้าง Assignment, สร้าง QR, เปิดหน้าคนขับ และดู Mission Control</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {report.issues.map((issue) => (
              <article key={issue.id} className={`rounded-2xl border p-4 ${severityStyle(issue.severity)}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold">{issue.area}</span>
                  <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold">
                    {issue.severity === "critical" ? "ควรแก้ก่อน" : "ต้องติดตาม"}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold">{issue.title}</h3>
                <p className="mt-1 text-sm leading-6">{issue.detail}</p>
                {issue.sample ? <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs font-mono">{issue.sample}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
