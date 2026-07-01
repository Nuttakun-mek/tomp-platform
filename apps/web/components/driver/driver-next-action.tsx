import { getNextDriverAction } from "@tomp/driver-core";
import type { DriverAssignmentPacket } from "@tomp/types/domain";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";
import { DriverQuickActions } from "./driver-quick-actions";

export function DriverNextAction({ driverAccess, mapsUrl, packet }: { driverAccess: DriverAccessAssignment; mapsUrl: string; packet: DriverAssignmentPacket }) {
  return (
    <section className="enterprise-panel p-4">
      <p className="px-1 text-sm font-semibold text-operation">งานถัดไปที่ต้องทำ</p>
      <p className="mt-1 px-1 text-lg font-semibold text-ink">{getNextDriverAction(packet.status)}</p>
      <p className="mt-1 px-1 text-sm leading-6 text-slate-600">กดสถานะให้ตรงกับความคืบหน้าจริง ศูนย์ควบคุมจะเห็นทันที</p>
      <div className="mt-4">
        <DriverQuickActions driverAccess={driverAccess} mapsUrl={mapsUrl} />
      </div>
    </section>
  );
}
