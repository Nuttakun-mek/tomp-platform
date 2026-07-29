import type { Assignment } from "@tomp/types/domain";
import { DriverAccessGenerator } from "@/components/driver/driver-access-generator";

export function DriverQrActionCard({ assignments, projectId }: { assignments: Assignment[]; projectId: string }) {
  const readyCount = assignments.filter((assignment) => assignment.callSignId && assignment.driverId && assignment.vehicleId).length;

  return (
    <section className="enterprise-panel-soft border-route/20 bg-blue-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-950">ลิงก์ QR สำหรับคนขับ</p>
          <p className="mt-1 text-sm leading-6 text-blue-900">เลือกงานที่มี Call Sign คนขับ และรถครบแล้ว เพื่อสร้างลิงก์ให้คนขับเปิดหน้างานและแชร์ GPS</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800 shadow-sm">{readyCount}/{assignments.length} งานพร้อมสร้าง QR</span>
      </div>
      <div className="mt-3">
        <DriverAccessGenerator assignments={assignments} projectId={projectId} />
      </div>
    </section>
  );
}
