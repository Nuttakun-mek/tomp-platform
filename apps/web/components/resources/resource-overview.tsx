import type { Driver, Vehicle } from "@tomp/types/domain";

export function ResourceOverview({ drivers, vehicles }: { drivers: Driver[]; vehicles: Vehicle[] }) {
  const readyDrivers = drivers.filter((driver) => driver.phone && driver.status !== "archived").length;
  const readyVehicles = vehicles.filter((vehicle) => vehicle.plateNumber && vehicle.status !== "archived" && vehicle.status !== "out_of_service").length;
  return (
    <section className="rounded-md border border-slate-200 bg-slate-950 p-5 text-white shadow-command">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-200">Resources Readiness</p>
      <h1 className="mt-1 text-2xl font-semibold">เตรียมคนขับและรถสำหรับปฏิบัติการ</h1>
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
    <div className="rounded-md border border-white/10 bg-white/10 p-4">
      <p className="text-xs font-semibold text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
