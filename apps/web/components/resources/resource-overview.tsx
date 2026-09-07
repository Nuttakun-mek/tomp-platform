import type { Driver, Vehicle } from "@tomp/types/domain";

export function ResourceOverview({ drivers, vehicles }: { drivers: Driver[]; vehicles: Vehicle[] }) {
  const readyDrivers = drivers.filter((driver) => driver.phone && driver.status !== "archived").length;
  const readyVehicles = vehicles.filter((vehicle) => vehicle.plateNumber && vehicle.status !== "archived" && vehicle.status !== "out_of_service").length;

  return (
    <section className="command-panel-dark rounded-3xl p-6 text-white shadow-command">
      <p className="text-xs font-semibold tracking-[0.16em] text-teal-200">ความพร้อมทรัพยากร</p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-[34px]">เตรียมคนขับและรถก่อนมอบงาน</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
        ใช้ตรวจข้อมูลพื้นฐาน ความพร้อม และคิวงานของทรัพยากร ก่อนส่งงานให้คนขับหรือเปิดติดตามบนแผนที่
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Metric label="คนขับทั้งหมด" value={drivers.length} />
        <Metric label="รถทั้งหมด" value={vehicles.length} />
        <Metric label="คนขับพร้อมใช้" value={readyDrivers} />
        <Metric label="รถพร้อมใช้" value={readyVehicles} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
      <p className="text-xs font-semibold text-slate-300">{label}</p>
      <p className="mt-2 text-3xl font-semibold leading-none text-white">{value}</p>
    </div>
  );
}
