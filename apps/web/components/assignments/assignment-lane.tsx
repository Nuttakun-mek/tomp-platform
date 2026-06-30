import type { Assignment, CallSign, Driver, Mission, Vehicle } from "@tomp/types/domain";
import { AssignmentRiskBadge } from "./assignment-risk-badge";
import { CallSignCard } from "./call-sign-card";
import { DriverVehiclePairCard } from "./driver-vehicle-pair-card";

interface LaneProps {
  title: string;
  assignments: Assignment[];
  missions: Mission[];
  callSigns: CallSign[];
  drivers: Driver[];
  vehicles: Vehicle[];
}

export function AssignmentLane({ title, assignments, missions, callSigns, drivers, vehicles }: LaneProps) {
  return (
    <section className="min-w-[280px] rounded-md border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-ink">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{assignments.length}</span>
      </div>
      <div className="mt-4 grid gap-3">
        {assignments.length ? (
          assignments.map((assignment) => {
            const mission = missions.find((item) => item.id === assignment.missionId);
            const callSign = callSigns.find((item) => item.id === assignment.callSignId);
            const driver = drivers.find((item) => item.id === assignment.driverId);
            const vehicle = vehicles.find((item) => item.id === assignment.vehicleId);
            return (
              <article key={assignment.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <CallSignCard callSign={callSign} />
                  <AssignmentRiskBadge assignment={assignment} />
                </div>
                <p className="mt-3 font-semibold text-ink">{mission?.missionName || "ยังไม่ระบุภารกิจ"}</p>
                <DriverVehiclePairCard driver={driver} vehicle={vehicle} />
                <p className="mt-2 text-xs text-slate-500">
                  {assignment.startTime ? new Date(assignment.startTime).toLocaleString("th-TH") : "ยังไม่ระบุเวลาเริ่ม"} - {assignment.endTime ? new Date(assignment.endTime).toLocaleTimeString("th-TH") : "ยังไม่ระบุเวลาสิ้นสุด"}
                </p>
              </article>
            );
          })
        ) : (
          <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">ยังไม่มีงานในกลุ่มนี้</p>
        )}
      </div>
    </section>
  );
}
