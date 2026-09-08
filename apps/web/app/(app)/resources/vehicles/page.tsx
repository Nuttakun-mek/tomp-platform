import { CreateVehicleForm } from "@/components/resources/create-vehicle-form";
import { ResourceQualityCard } from "@/components/resources/resource-quality-card";
import { VehicleFleetMap } from "@/components/resources/vehicle-fleet-map";
import { VehicleOperationsBoard } from "@/components/resources/vehicle-operations-board";
import { getVehicleOperationProfiles } from "@/lib/data/vehicle-operations";

export default async function VehiclesPage() {
  const profiles = await getVehicleOperationProfiles();
  const vehicles = profiles.map((profile) => profile.vehicle);
  const activeVehicles = profiles.filter((profile) => profile.currentTasks.length > 0).length;
  const pendingTasks = profiles.reduce((sum, profile) => sum + profile.remainingTasks.length, 0);
  const completedTasks = profiles.reduce((sum, profile) => sum + profile.completedTasks.length, 0);
  const locations = profiles
    .map((profile) => profile.latestLocation)
    .filter((location): location is NonNullable<typeof location> => Boolean(location));

  return (
    <>
      <section className="enterprise-panel p-5">
        <p className="page-kicker">จัดการรถ</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="page-title">ศูนย์จัดการรถและคิวงาน</h1>
            <p className="mt-2 page-description">
              ดูโปรไฟล์รถแต่ละคัน งานที่กำลังทำ งานคงเหลือ งานที่ทำแล้ว QR ประจำรถ และตำแหน่ง GPS ล่าสุดบนแผนที่รวม
            </p>
          </div>
          <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">ข้อมูลจากระบบจริง / fallback เมื่อไม่มีการเชื่อมต่อ</span>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <ResourceQualityCard title="รถทั้งหมด" value={`${vehicles.length}`} detail="โปรไฟล์รถในระบบ" />
        <ResourceQualityCard title="กำลังปฏิบัติงาน" value={`${activeVehicles}`} detail="มีงานปัจจุบันผูกกับรถ" />
        <ResourceQualityCard title="งานคงเหลือ" value={`${pendingTasks}`} detail="งานที่ยังรอออกปฏิบัติการ" />
        <ResourceQualityCard title="งานที่ทำแล้ว" value={`${completedTasks}`} detail="ประวัติงานที่เสร็จสิ้น" />
      </div>

      <VehicleFleetMap initialLocations={locations} />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <CreateVehicleForm />
        <VehicleOperationsBoard profiles={profiles} />
      </div>
    </>
  );
}
