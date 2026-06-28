import type { Assignment } from "@tomp/types/domain";
import { StatusBadge } from "@/components/ui/status-badge";
import { demoKernel } from "@/lib/demo/demo-kernel";

export function AssignmentSummaryCard({ assignment }: { assignment: Assignment }) {
  const callSign = demoKernel.callSigns.find((item) => item.id === assignment.callSignId)?.callSign ?? assignment.callSignId;
  const driver = demoKernel.drivers.find((item) => item.id === assignment.driverId)?.fullName ?? assignment.driverId ?? "Pending driver";
  const vehicle = demoKernel.vehicles.find((item) => item.id === assignment.vehicleId)?.plateNumber ?? assignment.vehicleId ?? "Pending vehicle";

  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-operation">Call Sign {callSign}</p>
          <h3 className="mt-1 text-base font-semibold text-ink">Mission {assignment.missionId}</h3>
          <p className="mt-1 text-sm text-slate-600">{driver} / {vehicle}</p>
          <p className="mt-1 text-xs text-slate-500">Driver access: /driver/demo-token</p>
        </div>
        <StatusBadge label={assignment.status} />
      </div>
    </article>
  );
}
