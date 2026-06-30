import type { Assignment, DriverLocation } from "@tomp/types/domain";
import { CommandPanel } from "@/components/ui/command-panel";
import { RiskBadge } from "@/components/ui/risk-badge";

export function AssignmentMonitor({ assignments, locations }: { assignments: Assignment[]; locations: DriverLocation[] }) {
  const locationAssignmentIds = new Set(locations.map((location) => location.assignmentId).filter(Boolean));
  return (
    <CommandPanel title="Assignment Monitor" eyebrow="งานที่จัดสรร">
      <div className="grid gap-3">
        {assignments.length ? (
          assignments.slice(0, 8).map((assignment) => {
            const hasGps = locationAssignmentIds.has(assignment.id);
            const missing = [!assignment.driverId ? "คนขับ" : null, !assignment.vehicleId ? "รถ" : null, !assignment.callSignId ? "Call Sign" : null].filter(Boolean);
            return (
              <article key={assignment.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">งานที่จัดสรร</p>
                    <p className="mt-1 text-xs text-slate-500">{assignment.id}</p>
                  </div>
                  <RiskBadge level={missing.length ? "medium" : hasGps ? "low" : "high"} />
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {missing.length ? `ยังขาดข้อมูล: ${missing.join(", ")}` : hasGps ? "มี GPS ล่าสุดแล้ว" : "ยังไม่มี GPS ล่าสุด"}
                </p>
              </article>
            );
          })
        ) : (
          <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">ยังไม่มีงานที่จัดสรรในโครงการนี้</p>
        )}
      </div>
    </CommandPanel>
  );
}
