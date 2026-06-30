import type { Vehicle } from "@tomp/types/domain";

export function VehicleReadinessTable({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <h2 className="text-lg font-semibold text-ink">ความพร้อมรถ</h2>
      <div className="mt-4 grid gap-2">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_160px_120px]">
            <p className="font-semibold text-ink">{vehicle.plateNumber || "ยังไม่ระบุทะเบียน"}</p>
            <p className="text-sm text-slate-600">{vehicle.vehicleType || "ยังไม่ระบุประเภท"} · {vehicle.capacity} ที่นั่ง</p>
            <p className="text-sm font-semibold text-operation">{vehicle.plateNumber ? "พร้อมใช้งาน" : "ขาดข้อมูล"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
