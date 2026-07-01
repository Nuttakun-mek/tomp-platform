import type { Assignment, DriverLocation } from "@tomp/types/domain";
import { CommandPanel } from "@/components/ui/command-panel";
import { RiskBadge } from "@/components/ui/risk-badge";

export function RiskAndExceptionPanel({ assignments, locations }: { assignments: Assignment[]; locations: DriverLocation[] }) {
  const locationAssignmentIds = new Set(locations.map((location) => location.assignmentId).filter(Boolean));
  const risks = assignments
    .map((assignment) => ({
      id: assignment.id,
      reason: !assignment.driverId ? "ยังไม่ระบุคนขับ" : !assignment.vehicleId ? "ยังไม่ระบุรถ" : !locationAssignmentIds.has(assignment.id) ? "ยังไม่มี GPS ล่าสุด" : null
    }))
    .filter((item) => item.reason);

  return (
    <CommandPanel title="รายการที่ต้องติดตาม" eyebrow="ความเสี่ยงปฏิบัติการ">
      <div className="grid gap-3">
        {risks.length ? (
          risks.slice(0, 6).map((risk) => (
            <article key={risk.id} className="rounded-[20px] border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-amber-950">{risk.reason}</p>
                <RiskBadge level="medium" />
              </div>
              <p className="mt-2 text-xs text-amber-800">Assignment {risk.id}</p>
            </article>
          ))
        ) : (
          <p className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">ยังไม่มีรายการที่ต้องติดตาม</p>
        )}
      </div>
    </CommandPanel>
  );
}
