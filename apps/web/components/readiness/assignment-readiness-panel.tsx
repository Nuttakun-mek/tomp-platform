import type { AssignmentReadiness } from "@tomp/types/domain";
import { RiskIndicator } from "./risk-indicator";
import { StatusBadge } from "@/components/ui/status-badge";

export function AssignmentReadinessPanel({ readiness }: { readiness: AssignmentReadiness }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Assignment Readiness</h2>
        <div className="flex gap-2">
          <StatusBadge label={readiness.status} tone={readiness.status === "ready" ? "ready" : readiness.status === "blocked" ? "critical" : "warning"} />
          <RiskIndicator risk={readiness.riskLevel} />
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">Missing: {readiness.missingItems.length ? readiness.missingItems.join(", ") : "none"}</p>
    </section>
  );
}
