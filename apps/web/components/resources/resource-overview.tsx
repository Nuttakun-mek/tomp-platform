import type { Driver, Vehicle } from "@tomp/types/domain";

export function ResourceOverview({ drivers, vehicles }: { drivers: Driver[]; vehicles: Vehicle[] }) {
  const readyDrivers = drivers.filter((driver) => driver.phone && driver.status !== "archived").length;
  const readyVehicles = vehicles.filter(
    (vehicle) => vehicle.plateNumber && vehicle.status !== "archived" && vehicle.status !== "out_of_service"
  ).length;

  return (
    <section className="command-panel-dark overflow-hidden p-6 text-white shadow-command sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-center">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-200">ความพร้อมทรัพยากร</p>
          <h1 className="display-title mt-3 max-w-lg text-white">เตรียมคนขับและรถก่อนมอบงาน</h1>
          <p className="mt-3 max-w-md text-[13px] leading-7 text-slate-300 sm:text-sm">
            ตรวจข้อมูลพื้นฐาน ความพร้อม และคิวงานของทรัพยากร ก่อนส่งงานให้คนขับหรือเปิดติดตามบนแผนที่
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Metric label="คนขับทั้งหมด" value={drivers.length} />
          <Metric label="รถทั้งหมด" value={vehicles.length} />
          <Metric label="คนขับพร้อมใช้" value={readyDrivers} tone="ready" />
          <Metric label="รถพร้อมใช้" value={readyVehicles} tone="ready" />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "ready" }) {
  return (
    <div className="rounded-card border border-white/10 bg-white/[0.06] p-4">
      <p className="text-[12px] font-semibold text-slate-300">{label}</p>
      <p className={`mt-1.5 text-[26px] font-semibold leading-none [font-variant-numeric:tabular-nums] ${tone === "ready" ? "text-emerald-200" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
