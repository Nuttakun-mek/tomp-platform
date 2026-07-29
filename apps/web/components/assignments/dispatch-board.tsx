import type { Assignment, CallSign, Driver, Mission, Vehicle } from "@tomp/types/domain";
import { DriverQrActionCard } from "./driver-qr-action-card";
import { AssignmentLane } from "./assignment-lane";

interface DispatchBoardProps {
  projectId: string;
  assignments: Assignment[];
  missions: Mission[];
  callSigns: CallSign[];
  drivers: Driver[];
  vehicles: Vehicle[];
}

const laneDefinitions = [
  { title: "ต้องติดตาม", match: (assignment: Assignment) => ["draft", "planned"].includes(assignment.status) && (!assignment.driverId || !assignment.vehicleId || !assignment.callSignId) },
  { title: "เตรียมพร้อม", match: (assignment: Assignment) => Boolean(assignment.driverId && assignment.vehicleId && assignment.callSignId) && ["draft", "planned"].includes(assignment.status) },
  { title: "พร้อมปฏิบัติงาน", match: (assignment: Assignment) => assignment.status === "published" },
  { title: "กำลังปฏิบัติงาน", match: (assignment: Assignment) => assignment.status === "active" },
  { title: "เสร็จสิ้น", match: (assignment: Assignment) => assignment.status === "completed" },
  { title: "ยกเลิก", match: (assignment: Assignment) => assignment.status === "cancelled" }
];

export function DispatchBoard({ projectId, assignments, missions, callSigns, drivers, vehicles }: DispatchBoardProps) {
  return (
    <section className="grid gap-6">
      <div className="enterprise-panel-soft p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-operation">บอร์ดจัดสรรงาน</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">บอร์ดจัดสรรงาน</h1>
            <p className="mt-1 text-sm text-slate-600">สแกนสถานะ Call Sign คนขับ รถ QR และความเสี่ยงของงานที่จัดสรร</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{assignments.length} งาน</span>
        </div>
      </div>
      <DriverQrActionCard assignments={assignments} projectId={projectId} />
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1180px] grid-cols-6 gap-4">
          {laneDefinitions.map((lane) => (
            <AssignmentLane
              key={lane.title}
              title={lane.title}
              assignments={assignments.filter(lane.match)}
              missions={missions}
              callSigns={callSigns}
              drivers={drivers}
              vehicles={vehicles}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
