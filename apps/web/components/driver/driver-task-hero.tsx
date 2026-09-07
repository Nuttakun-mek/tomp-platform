import { MapPinned, Navigation } from "lucide-react";
import type { DriverAssignmentPacket } from "@tomp/types/domain";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";
import { formatStatusTh } from "@/lib/i18n/status-th";

export function DriverTaskHero({ driverAccess, mapsUrl, packet }: { driverAccess: DriverAccessAssignment; mapsUrl: string; packet: DriverAssignmentPacket }) {
  const driverName = driverAccess.driver.fullName || "ยังไม่ระบุคนขับ";

  return (
    <section className="overflow-hidden rounded-[28px] bg-slate-950 text-white shadow-[0_24px_70px_rgba(12,34,52,0.28)]">
      <div className="command-grid p-5 sm:p-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-300/25 bg-teal-300/10 px-3 py-1.5 text-[12px] font-semibold text-teal-100">
          <MapPinned className="h-4 w-4" />
          งานของคุณวันนี้
        </div>

        <h1 className="mt-4 text-[34px] font-semibold leading-none sm:text-[42px]">Call Sign {packet.callSign}</h1>
        <p className="mt-3 text-base font-medium text-slate-100">{driverName}</p>
        <p className="mt-1 text-sm leading-6 text-slate-300">{packet.projectName}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-300 px-3 py-1 text-[12px] font-semibold text-amber-950">{formatStatusTh(driverAccess.assignment.status)}</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-white">ชุดงาน v{packet.packetVersion}</span>
        </div>

        <a className="mt-5 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-route px-5 py-3 text-base font-semibold text-white shadow-[0_16px_36px_rgba(37,99,235,0.28)]" href={mapsUrl}>
          <Navigation className="h-5 w-5" />
          เปิด Google Maps
        </a>
      </div>
    </section>
  );
}
