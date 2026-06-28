import type { Mission } from "@tomp/types/domain";
import { StatusBadge } from "@/components/ui/status-badge";

export function MissionSummaryCard({ mission }: { mission: Mission }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-operation">{mission.missionCode}</p>
          <h3 className="mt-1 text-base font-semibold text-ink">{mission.missionName}</h3>
          <p className="mt-1 text-sm text-slate-600">{mission.missionType}</p>
        </div>
        <StatusBadge label={mission.status} />
      </div>
    </article>
  );
}
