import { CreateVehicleForm } from "@/components/resources/create-vehicle-form";
import { ResourceQualityCard } from "@/components/resources/resource-quality-card";
import { VehicleReadinessTable } from "@/components/resources/vehicle-readiness-table";
import { getVehicles } from "@/lib/data/resources";

export default async function VehiclesPage() {
  const vehicles = await getVehicles();
  const missingPlate = vehicles.filter((vehicle) => !vehicle.plateNumber).length;

  return (
    <>
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-operation">Vehicles</p>
        <h1 className="mt-1 text-3xl font-semibold text-ink">รถ</h1>
        <p className="mt-2 text-sm text-slate-600">เตรียมทะเบียน ประเภทรถ ความจุ และสถานะพร้อมใช้สำหรับงานที่จัดสรร</p>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        <ResourceQualityCard title="รถทั้งหมด" value={`${vehicles.length}`} detail="จากฐานข้อมูลปัจจุบัน" />
        <ResourceQualityCard title="พร้อมใช้งาน" value={`${vehicles.length - missingPlate}`} detail="มีทะเบียนและข้อมูลหลักครบ" />
        <ResourceQualityCard title="ขาดข้อมูล" value={`${missingPlate}`} detail="ควรตรวจทะเบียนก่อนใช้งาน" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <CreateVehicleForm />
        <VehicleReadinessTable vehicles={vehicles} />
      </div>
    </>
  );
}
