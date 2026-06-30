import type { Assignment } from "@tomp/types/domain";
import { StatusBadge } from "@/components/ui/status-badge";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { formatStatusTh } from "@/lib/i18n/status-th";

export function AssignmentSummaryCard({ assignment }: { assignment: Assignment }) {
  const callSign = demoKernel.callSigns.find((item) => item.id === assignment.callSignId)?.callSign ?? assignment.callSignId;
  const driver = demoKernel.drivers.find((item) => item.id === assignment.driverId)?.fullName ?? assignment.driverId ?? "รอเลือกคนขับ";
  const vehicle = demoKernel.vehicles.find((item) => item.id === assignment.vehicleId)?.plateNumber ?? assignment.vehicleId ?? "รอเลือกรถ";

  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-operation">Call Sign {callSign}</p>
          <h3 className="mt-1 text-base font-semibold text-ink">ภารกิจ {assignment.missionId}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {driver} / {vehicle}
          </p>
          <p className="mt-1 text-xs text-slate-500">สร้าง QR จริงจากส่วน “สร้างลิงก์ QR สำหรับคนขับ” ในหน้านี้</p>
        </div>
        <StatusBadge label={formatStatusTh(assignment.status)} />
      </div>
    </article>
  );
}
