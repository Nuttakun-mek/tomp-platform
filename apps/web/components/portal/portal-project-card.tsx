import type { Mission, Project } from "@tomp/types/domain";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatStatusTh } from "@/lib/i18n/status-th";

const DONE = new Set(["completed", "closed", "cancelled"]);
const ACTIVE = new Set(["active", "operating", "in_progress", "en_route_pickup", "en_route_dropoff", "passenger_onboard"]);

export function PortalProjectCard({ project, missions }: { project: Project; missions: Mission[] }) {
  const done = missions.filter((mission) => DONE.has(mission.status)).length;
  const active = missions.filter((mission) => ACTIVE.has(mission.status)).length;
  const pending = missions.length - done - active;

  return (
    <article className="smart-card grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="section-label">{project.projectCode}</p>
          <h3 className="card-title mt-1">{project.projectName}</h3>
        </div>
        <StatusBadge label={formatStatusTh(project.status)} />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ["กำลังดำเนินการ", active],
          ["รอดำเนินการ", Math.max(0, pending)],
          ["เสร็จสิ้น", done]
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-border bg-white px-2 py-2.5">
            <dd className="text-lg font-semibold text-ink">{value}</dd>
            <dt className="text-[11px] font-medium text-ink-faint">{label}</dt>
          </div>
        ))}
      </dl>
    </article>
  );
}
