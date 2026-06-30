import type { Assignment, CallSign, Driver, Mission, Vehicle } from "@tomp/types/domain";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatStatusTh } from "@/lib/i18n/status-th";

interface AssignmentSummaryCardProps {
  assignment: Assignment;
  mission?: Mission;
  callSign?: CallSign;
  driver?: Driver;
  vehicle?: Vehicle;
}

export function AssignmentSummaryCard({ assignment, mission, callSign, driver, vehicle }: AssignmentSummaryCardProps) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-operation">Call Sign {callSign?.callSign || assignment.callSignId}</p>
          <h3 className="mt-1 text-base font-semibold text-ink">{mission?.missionName || `ภารกิจ ${assignment.missionId}`}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {driver?.fullName || "ยังไม่ระบุคนขับ"} / {vehicle?.plateNumber || "ยังไม่ระบุรถ"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {assignment.startTime ? new Date(assignment.startTime).toLocaleString("th-TH") : "ยังไม่ระบุเวลาเริ่ม"} -{" "}
            {assignment.endTime ? new Date(assignment.endTime).toLocaleTimeString("th-TH") : "ยังไม่ระบุเวลาสิ้นสุด"}
          </p>
        </div>
        <StatusBadge label={formatStatusTh(assignment.status)} />
      </div>
    </article>
  );
}
