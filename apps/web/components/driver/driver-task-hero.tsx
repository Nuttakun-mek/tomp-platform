import type { DriverAccessAssignment } from "@/lib/data/driver-access";
import { formatStatusTh } from "@/lib/i18n/status-th";

export function DriverTaskHero({ driverAccess, mapsUrl }: { driverAccess: DriverAccessAssignment; mapsUrl: string }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-command">
      <div className="command-grid p-5">
        <p className="text-sm font-semibold text-teal-200">งานของคุณวันนี้</p>
        <h1 className="mt-2 text-4xl font-semibold">Call Sign {driverAccess.callSign.callSign}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-200">{driverAccess.project.projectName}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-semibold text-amber-950">{formatStatusTh(driverAccess.assignment.status)}</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">{driverAccess.driver.fullName || "ยังไม่ระบุคนขับ"}</span>
        </div>
        <a className="mt-6 flex min-h-14 items-center justify-center rounded-xl bg-route px-5 py-3 text-lg font-semibold text-white shadow-sm" href={mapsUrl}>
          เปิด Google Maps
        </a>
      </div>
    </section>
  );
}
