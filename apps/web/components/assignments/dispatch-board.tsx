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
    <section className="grid gap-5">
      <div className="enterprise-panel-soft p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="section-label">บอร์ดจัดสรรงาน</p>
            <h2 className="section-title mt-1">ติดตามงานที่มอบให้รถและคนขับ</h2>
            <p className="section-description mt-1">แยกตามสถานะ เพื่อให้ dispatcher เห็นทันทีว่างานใดพร้อม งานใดต้องติดตาม และงานใดถูกถอนแล้ว</p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{assignments.length} งาน</span>
        </div>
      </div>
      <DriverQrActionCard assignments={assignments} projectId={projectId} />
      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="grid grid-flow-col auto-cols-[minmax(272px,1fr)] gap-4">
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
