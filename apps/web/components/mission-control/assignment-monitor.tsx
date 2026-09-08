import type { Assignment, CallSign, DriverLocation } from "@tomp/types/domain";
import { CommandPanel } from "@/components/ui/command-panel";
import { RiskBadge } from "@/components/ui/risk-badge";
import type { AssignmentStatusUpdate } from "@/lib/data/assignment-status";
import { formatStatusTh } from "@/lib/i18n/status-th";
import { formatRelativeTh } from "@/lib/ui/relative-time";

export function AssignmentMonitor({
  assignments,
  locations,
  statuses = {},
  callSigns = []
}: {
  assignments: Assignment[];
  locations: DriverLocation[];
  statuses?: Record<string, AssignmentStatusUpdate>;
  callSigns?: CallSign[];
}) {
  const locationAssignmentIds = new Set(locations.map((location) => location.assignmentId).filter(Boolean));
  const callSignById = new Map(callSigns.map((cs) => [cs.id, cs.callSign]));

  return (
    <CommandPanel title="ติดตามงานที่จัดสรร" eyebrow="กระดานติดตามงาน">
      <div className="grid gap-3">
        {assignments.length ? (
          assignments.slice(0, 8).map((assignment) => {
            const hasGps = locationAssignmentIds.has(assignment.id);
            const missing = [!assignment.driverId ? "คนขับ" : null, !assignment.vehicleId ? "รถ" : null, !assignment.callSignId ? "Call Sign" : null].filter(Boolean);
            const reported = statuses[assignment.id];
            const label = callSignById.get(assignment.callSignId) ?? `งาน ${assignment.id.slice(0, 8)}`;
            return (
              <article key={assignment.id} className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">Call Sign {label}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      สถานะแผน: {formatStatusTh(assignment.status)}
                    </p>
                  </div>
                  <RiskBadge level={missing.length ? "medium" : hasGps ? "low" : "high"} />
                </div>

                {reported ? (
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    ● {formatStatusTh(reported.status)} · แจ้งโดยคนขับ {formatRelativeTh(reported.at)}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    {missing.length ? `ยังขาดข้อมูล: ${missing.join(", ")}` : hasGps ? "มี GPS ล่าสุดแล้ว · ยังไม่มีสถานะจากคนขับ" : "ยังไม่มี GPS และสถานะจากคนขับ"}
                  </p>
                )}
              </article>
            );
          })
        ) : (
          <p className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">ยังไม่มีงานที่จัดสรรในโครงการนี้</p>
        )}
      </div>
    </CommandPanel>
  );
}
