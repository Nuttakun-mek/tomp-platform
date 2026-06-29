import { ChangeImpactSummary } from "@/components/change/change-impact-summary";
import { ChangeStatusBadge } from "@/components/change/change-status-badge";

export function ChangeRequestDetail() {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-operation">Change Detail</p>
          <h3 className="mt-1 text-base font-semibold text-ink">Post-publish assignment adjustment</h3>
        </div>
        <ChangeStatusBadge status="requested" />
      </div>
      <div className="mt-4">
        <ChangeImpactSummary summary="Coordinator must notify driver and update call sign board before dispatch." severity="medium" />
      </div>
    </article>
  );
}

