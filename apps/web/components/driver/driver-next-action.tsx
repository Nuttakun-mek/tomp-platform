import type { DriverAccessAssignment } from "@/lib/data/driver-access";
import { DriverQuickActions } from "./driver-quick-actions";

export function DriverNextAction({ driverAccess, mapsUrl }: { driverAccess: DriverAccessAssignment; mapsUrl: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <p className="px-1 text-sm font-semibold text-operation">ขั้นตอนถัดไป</p>
      <p className="mt-1 px-1 text-sm text-slate-600">กดสถานะให้ตรงกับความคืบหน้าจริง ศูนย์ควบคุมจะเห็นทันที</p>
      <div className="mt-4">
        <DriverQuickActions driverAccess={driverAccess} mapsUrl={mapsUrl} />
      </div>
    </section>
  );
}
