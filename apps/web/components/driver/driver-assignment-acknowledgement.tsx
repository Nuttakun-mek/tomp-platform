import type { DriverAccessAssignment } from "@/lib/data/driver-access";

export function DriverAssignmentAcknowledgement({ driverAccess }: { driverAccess: DriverAccessAssignment }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <p className="text-sm font-semibold text-operation">Assignment Packet</p>
      <div className="mt-3 grid gap-2 text-sm text-slate-700">
        <p>
          <span className="font-semibold text-slate-950">เวอร์ชัน:</span> {driverAccess.assignment.currentVersion}
        </p>
        <p>
          <span className="font-semibold text-slate-950">Call Sign:</span> {driverAccess.callSign.callSign}
        </p>
        <p>
          <span className="font-semibold text-slate-950">สถานะรับทราบ:</span> รอคนขับกดรับทราบ
        </p>
      </div>
      <button className="mt-4 min-h-12 w-full rounded-xl bg-operation px-4 py-3 text-sm font-semibold text-white" type="button">
        กดรับทราบงาน
      </button>
    </section>
  );
}
