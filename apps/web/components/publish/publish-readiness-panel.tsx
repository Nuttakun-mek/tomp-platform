import type { PublishReadinessResult } from "@/lib/domain/publish-readiness";
import { StatusBadge } from "@/components/ui/status-badge";

export function PublishReadinessPanel({ readiness }: { readiness: PublishReadinessResult }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Publish Readiness</h2>
        <StatusBadge label={readiness.canPublish ? "Ready to publish" : "Blocked"} tone={readiness.canPublish ? "ready" : "critical"} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Blockers</h3>
          <ul className="mt-2 grid gap-2 text-sm text-slate-600">
            {readiness.blockers.length ? readiness.blockers.map((item) => <li key={item}>{item}</li>) : <li>No blocking issues detected.</li>}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Warnings</h3>
          <ul className="mt-2 grid gap-2 text-sm text-slate-600">
            {readiness.warnings.length ? readiness.warnings.map((item) => <li key={item}>{item}</li>) : <li>No publish warnings detected.</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}

