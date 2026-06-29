import type { PublishReadinessResult } from "@/lib/domain/publish-readiness";
import { StatusBadge } from "@/components/ui/status-badge";

export function PublishReadinessPanel({ readiness }: { readiness: PublishReadinessResult }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">ความพร้อมก่อนประกาศใช้แผน</h2>
        <StatusBadge label={readiness.canPublish ? "พร้อมประกาศใช้" : "ยังมีเงื่อนไขที่ต้องแก้"} tone={readiness.canPublish ? "ready" : "critical"} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">เงื่อนไขที่ต้องแก้ก่อน</h3>
          <ul className="mt-2 grid gap-2 text-sm text-slate-600">
            {readiness.blockers.length ? readiness.blockers.map((item) => <li key={item}>{item}</li>) : <li>ไม่พบเงื่อนไขที่ขวางการประกาศใช้แผน</li>}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-700">คำเตือน</h3>
          <ul className="mt-2 grid gap-2 text-sm text-slate-600">
            {readiness.warnings.length ? readiness.warnings.map((item) => <li key={item}>{item}</li>) : <li>ไม่พบคำเตือนก่อนประกาศใช้แผน</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}
