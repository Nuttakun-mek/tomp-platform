import type { ReadinessStatus } from "@tomp/types/domain";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatStatusTh } from "@/lib/i18n/status-th";

export function ReadinessScoreCard({ title, score, status }: { title: string; score: number; status: ReadinessStatus }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <StatusBadge label={formatStatusTh(status)} tone={status === "ready" ? "ready" : status === "blocked" ? "critical" : "warning"} />
      </div>
      <p className="mt-4 text-3xl font-semibold text-ink">{score}%</p>
    </article>
  );
}
