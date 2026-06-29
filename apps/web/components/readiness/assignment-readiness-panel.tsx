import type { AssignmentReadiness } from "@tomp/types/domain";
import { RiskIndicator } from "./risk-indicator";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatStatusTh } from "@/lib/i18n/status-th";

const missingItemLabels: Record<string, string> = {
  "call sign": "ยังไม่มี Call Sign",
  driver: "ยังไม่มีคนขับ",
  vehicle: "ยังไม่มีรถ",
  "time window": "ยังไม่มีช่วงเวลา"
};

export function AssignmentReadinessPanel({ readiness }: { readiness: AssignmentReadiness }) {
  const missingItems = readiness.missingItems.map((item) => missingItemLabels[item] ?? item);
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">ความพร้อมของ Assignment</h2>
        <div className="flex gap-2">
          <StatusBadge label={formatStatusTh(readiness.status)} tone={readiness.status === "ready" ? "ready" : readiness.status === "blocked" ? "critical" : "warning"} />
          <RiskIndicator risk={readiness.riskLevel} />
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">ข้อมูลที่ต้องเติม: {missingItems.length ? missingItems.join(", ") : "ครบถ้วน"}</p>
    </section>
  );
}
