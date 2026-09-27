import { formatStatusTh } from "@/lib/i18n/status-th";

// One colour per job status everywhere a job is listed, so "กำลังปฏิบัติงาน" is
// the same green on the dispatch card, the fleet card and the job list.
const TONE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  in_progress: "bg-emerald-100 text-emerald-800",
  acknowledged: "bg-blue-50 text-blue-800",
  ready: "bg-blue-50 text-blue-800",
  arrived_pickup: "bg-blue-50 text-blue-800",
  passenger_onboard: "bg-emerald-50 text-emerald-800",
  blocked: "bg-rose-50 text-rose-800",
  parked: "bg-amber-50 text-amber-800",
  completed: "bg-slate-100 text-ink-faint",
  cancelled: "bg-slate-100 text-ink-faint line-through"
};

export function JobStatusChip({ status, className = "" }: { status: string; className?: string }) {
  return (
    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${TONE[status] ?? "bg-slate-100 text-ink-soft"} ${className}`}>
      {formatStatusTh(status)}
    </span>
  );
}
