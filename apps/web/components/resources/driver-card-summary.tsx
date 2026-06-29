import type { Driver } from "@tomp/types/domain";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatStatusTh } from "@/lib/i18n/status-th";

export function DriverCardSummary({ driver }: { driver: Driver }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">{driver.fullName}</h3>
          <p className="mt-1 text-sm text-slate-600">{driver.phone} / {driver.languages.join(", ") || "รอระบุภาษา"}</p>
        </div>
        <StatusBadge label={formatStatusTh(driver.status)} tone="ready" />
      </div>
    </article>
  );
}
