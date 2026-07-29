import { CreateVehicleForm } from "@/components/resources/create-vehicle-form";
import { ResourceQualityCard } from "@/components/resources/resource-quality-card";
import { VehicleReadinessTable } from "@/components/resources/vehicle-readiness-table";
import { getVehicles } from "@/lib/data/resources";

export default async function VehiclesPage() {
  const vehicles = await getVehicles();
  const missingPlate = vehicles.filter((vehicle) => !vehicle.plateNumber).length;

  return (
    <>
      <section className="enterprise-panel p-5">
        <p className="page-kicker">Vehicles</p>
        <h1 className="mt-1 page-title">รถ</h1>
        <p className="mt-2 page-description">เตรียมทะเบียน ประเภทรถ ความจุ และสถานะพร้อมใช้สำหรับงานที่จัดสรร</p>
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
