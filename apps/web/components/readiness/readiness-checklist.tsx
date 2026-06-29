import type { ReadinessCheckItem } from "@tomp/types/domain";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatStatusTh } from "@/lib/i18n/status-th";

export function ReadinessChecklist({ items }: { items: ReadinessCheckItem[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
          <span className="text-sm text-slate-700">{item.label}{item.required ? " *" : ""}</span>
          <StatusBadge label={formatStatusTh(item.status)} tone={item.status === "ready" ? "ready" : item.status === "blocked" ? "critical" : "warning"} />
        </div>
      ))}
    </div>
  );
}
