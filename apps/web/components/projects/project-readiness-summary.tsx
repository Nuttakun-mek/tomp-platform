import { ProgressBar } from "@/components/ui/progress-bar";

export function ProjectReadinessSummary({ missions, assignments }: { missions: number; assignments: number }) {
  const score = missions ? Math.min(100, Math.round((assignments / missions) * 100)) : 0;
  return (
    <section className="enterprise-panel p-5">
      <p className="text-xs font-semibold tracking-[0.16em] text-operation">ความพร้อม</p>
      <h2 className="mt-1 text-lg font-semibold text-ink">ความพร้อมโครงการ</h2>
      <p className="mt-4 text-3xl font-semibold text-ink">{score}%</p>
      <div className="mt-3">
        <ProgressBar value={score} tone={score > 70 ? "operation" : "warning"} />
      </div>
      <p className="mt-3 text-sm text-slate-600">ภารกิจ {missions} รายการ · งานที่จัดสรร {assignments} รายการ</p>
    </section>
  );
}
