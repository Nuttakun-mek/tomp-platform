import { ProgressBar } from "@/components/ui/progress-bar";

export function ReadinessOverview({ score, gpsCount, assignmentCount }: { score: number; gpsCount: number; assignmentCount: number }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-operation">Readiness</p>
      <h2 className="mt-1 text-lg font-semibold text-ink">ความพร้อมรวม</h2>
      <p className="mt-4 text-4xl font-semibold text-ink">{score}%</p>
      <div className="mt-4">
        <ProgressBar value={score} tone={score >= 70 ? "operation" : score >= 40 ? "warning" : "danger"} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        มีตำแหน่ง GPS ล่าสุด {gpsCount} รายการ จากงานที่จัดสรร {assignmentCount} งาน ใช้เพื่อประเมินความพร้อมเชิงปฏิบัติการเบื้องต้น
      </p>
    </section>
  );
}
