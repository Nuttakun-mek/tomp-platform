import type { Assignment, CallSign, Driver, Mission, Vehicle } from "@tomp/types/domain";
import { AssignmentSummaryCard } from "@/components/assignments/assignment-summary-card";

interface AssignmentBoardProps {
  assignments?: Assignment[];
  missions?: Mission[];
  callSigns?: CallSign[];
  drivers?: Driver[];
  vehicles?: Vehicle[];
}

export function AssignmentBoardPlaceholder({ assignments, missions = [], callSigns = [], drivers = [], vehicles = [] }: AssignmentBoardProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">งานที่จัดสรรแล้ว</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">รายการ Assignment จริงของโครงการนี้ ใช้สำหรับสร้าง QR และติดตามใน Mission Control</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{assignments?.length || 0} งาน</span>
      </div>

      {assignments?.length ? (
        <div className="mt-4 grid gap-3">
          {assignments.map((assignment) => (
            <AssignmentSummaryCard
              key={assignment.id}
              assignment={assignment}
              mission={missions.find((mission) => mission.id === assignment.missionId)}
              callSign={callSigns.find((callSign) => callSign.id === assignment.callSignId)}
              driver={drivers.find((driver) => driver.id === assignment.driverId)}
              vehicle={vehicles.find((vehicle) => vehicle.id === assignment.vehicleId)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
          ยังไม่มี Assignment ในโครงการนี้ หากต้องการทดสอบทันที ให้เปิดเมนู “ทดสอบ GPS สด” เพื่อสร้างชุดข้อมูลครบชุด
        </div>
      )}
    </section>
  );
}
