import { EmptyState } from "@/components/ui/empty-state";
import { formatTimelineEventTh } from "@/lib/i18n/timeline-th";
import { formatRelativeTh } from "@/lib/format/relative-time-th";
import type { AuditRow } from "@/lib/superadmin/overview";

export function AuditFeed({ rows }: { rows: AuditRow[] }) {
  if (!rows.length) {
    return <EmptyState title="ยังไม่มีกิจกรรมในระบบ" description="กิจกรรมจะปรากฏเมื่อมีการสร้างหรือแก้ไขข้อมูลในโครงการ" />;
  }

  return (
    <ul className="grid gap-2">
      {rows.map((row) => (
        <li key={row.id} className="smart-card grid gap-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{formatTimelineEventTh(row.eventType) || row.eventType || "กิจกรรม"}</p>
            <span className="meta-text shrink-0">{formatRelativeTh(row.createdAt)}</span>
          </div>
          <p className="text-[12px] text-ink-soft">
            {row.projectName} · {row.actorName ?? "ระบบ"}
          </p>
          {row.reason ? <p className="text-[12px] text-ink-faint">เหตุผล: {row.reason}</p> : null}
        </li>
      ))}
    </ul>
  );
}
