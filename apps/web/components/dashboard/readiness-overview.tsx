import { ProgressBar } from "@/components/ui/progress-bar";

export function ReadinessOverview({ score, gpsCount, assignmentCount }: { score: number; gpsCount: number; assignmentCount: number }) {
  return (
    <section className="enterprise-panel p-5">
      <p className="text-xs font-semibold tracking-[0.16em] text-operation">READINESS</p>
      <h2 className="mt-1 text-xl font-semibold text-ink">ความพร้อมรวม</h2>
      <p className="mt-4 text-5xl font-semibold text-ink">{score}%</p>
      <div className="mt-4">
        <ProgressBar value={score} tone={score >= 70 ? "operation" : score >= 40 ? "warning" : "danger"} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        มีตำแหน่ง GPS ล่าสุด {gpsCount} รายการ จากงานที่จัดสรร {assignmentCount} งาน ใช้เพื่อประเมินความพร้อมเชิงปฏิบัติการเบื้องต้น
      </p>
    </section>
  );
}
