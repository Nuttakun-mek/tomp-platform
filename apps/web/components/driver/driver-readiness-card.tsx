import type { DriverAccessAssignment } from "@/lib/data/driver-access";
import { DriverActivationChecklist } from "./driver-activation-checklist";

export function DriverReadinessCard({ driverAccess }: { driverAccess: DriverAccessAssignment }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <p className="px-1 text-sm font-semibold text-operation">ความพร้อมก่อนเริ่มงาน</p>
      <p className="mt-1 px-1 text-sm text-slate-600">ตรวจข้อมูลสำคัญก่อนเริ่มงานและก่อนแชร์ GPS</p>
      <div className="mt-4">
        <DriverActivationChecklist driverAccess={driverAccess} />
      </div>
    </section>
  );
}
