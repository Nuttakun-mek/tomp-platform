import type { Assignment, CallSign, Driver, Mission, Vehicle } from "@tomp/types/domain";
import { AssignmentRiskBadge } from "./assignment-risk-badge";
import { CallSignCard } from "./call-sign-card";
import { DriverVehiclePairCard } from "./driver-vehicle-pair-card";
import { CancelAssignmentButton } from "@/components/assignments/cancel-assignment-button";

interface LaneProps {
  title: string;
  assignments: Assignment[];
  missions: Mission[];
  callSigns: CallSign[];
  drivers: Driver[];
  vehicles: Vehicle[];
}

function timeLabel(value?: string | null) {
  if (!value) return "ยังไม่ระบุเวลา";
  return new Date(value).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

export function AssignmentLane({ title, assignments, missions, callSigns, drivers, vehicles }: LaneProps) {
  return (
    <section className="min-w-0 rounded-panel border border-border/80 bg-canvas/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="card-title truncate">{title}</h3>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink-soft shadow-sm">{assignments.length}</span>
      </div>
      <div className="mt-4 grid gap-3">
        {assignments.length ? (
          assignments.map((assignment) => {
            const mission = missions.find((item) => item.id === assignment.missionId);
            const callSign = callSigns.find((item) => item.id === assignment.callSignId);
            const driver = drivers.find((item) => item.id === assignment.driverId);
            const vehicle = vehicles.find((item) => item.id === assignment.vehicleId);
            const canCancel = !["completed", "cancelled", "archived"].includes(assignment.status);
            return (
              <article key={assignment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <CallSignCard callSign={callSign} />
                  <AssignmentRiskBadge assignment={assignment} />
                </div>
                <p className="mt-3 line-clamp-2 font-semibold text-ink">{mission?.missionName || "ยังไม่ระบุภารกิจ"}</p>
                <DriverVehiclePairCard driver={driver} vehicle={vehicle} />
                <p className="mt-2 text-xs text-slate-500">{timeLabel(assignment.startTime)}</p>
                {canCancel ? (
                  <div className="mt-3">
                    <CancelAssignmentButton projectId={assignment.projectId} assignmentId={assignment.id} />
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">ยังไม่มีงานในกลุ่มนี้</p>
        )}
      </div>
    </section>
  );
}
