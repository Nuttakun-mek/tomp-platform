import type { Mission } from "@tomp/types/domain";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatStatusTh } from "@/lib/i18n/status-th";

function timeLabel(iso?: string | null) {
  if (!iso) return "ยังไม่กำหนดเวลา";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "ยังไม่กำหนดเวลา";
  return date.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function PortalMissionStatus({ missions }: { missions: Mission[] }) {
  if (!missions.length) {
    return <EmptyState title="ยังไม่มีภารกิจในโครงการนี้" description="เมื่อทีมปฏิบัติการวางแผนแล้ว ภารกิจจะแสดงที่นี่" />;
  }

  return (
    <section className="enterprise-panel grid gap-3 p-5">
      <p className="section-label">สถานะภารกิจ</p>
      <ul className="grid gap-2">
        {missions.map((mission) => (
          <li key={mission.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-white px-3 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">
                {mission.missionCode} · {mission.missionName}
              </span>
              <span className="block text-[12px] text-ink-faint">{timeLabel(mission.plannedStartTime)}</span>
            </span>
            <StatusBadge label={formatStatusTh(mission.status)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
