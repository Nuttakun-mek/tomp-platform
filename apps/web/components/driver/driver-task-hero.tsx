import type { DriverAssignmentPacket } from "@tomp/types/domain";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";
import { formatStatusTh } from "@/lib/i18n/status-th";

export function DriverTaskHero({ driverAccess, mapsUrl, packet }: { driverAccess: DriverAccessAssignment; mapsUrl: string; packet: DriverAssignmentPacket }) {
  return (
    <section className="command-panel-dark overflow-hidden rounded-3xl text-white shadow-command">
      <div className="command-grid p-5">
        <p className="text-sm font-semibold text-teal-200">งานของคุณวันนี้</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight">Call Sign {packet.callSign}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-200">{packet.projectName}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-300 px-3 py-1 text-[12px] font-semibold text-amber-950">{formatStatusTh(driverAccess.assignment.status)}</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-white">{driverAccess.driver.fullName || "ยังไม่ระบุคนขับ"}</span>
          <span className="rounded-full bg-teal-400/15 px-3 py-1 text-[12px] font-semibold text-teal-100">Packet v{packet.packetVersion}</span>
        </div>
        <a className="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-route px-5 py-3 text-base font-semibold text-white shadow-sm" href={mapsUrl}>
          เปิด Google Maps
        </a>
      </div>
    </section>
  );
}
