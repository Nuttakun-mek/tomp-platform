import { Library } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { CreateDriverForm } from "@/components/resources/create-driver-form";
import { CreateVehicleForm } from "@/components/resources/create-vehicle-form";
import { ProjectResourceManager } from "@/components/resources/project-resource-manager";
import { getDrivers, getResourceUsage, getVehicles } from "@/lib/data/resources";

export default async function ResourcesPage() {
  const [drivers, vehicles, usage] = await Promise.all([getDrivers(), getVehicles(), getResourceUsage()]);

  return (
    <div className="grid gap-4">
      <section className="enterprise-panel-soft p-4">
        <p className="flex items-center gap-2 text-xs font-semibold text-operation">
          <Library className="h-4 w-4" /> ศูนย์รวมทรัพยากรกลาง
        </p>
        <h1 className="mt-1 text-lg font-semibold text-ink">คนขับและรถทั้งหมดขององค์กร</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
          ที่เก็บถาวรของคนขับ {drivers.length} คน และรถ {vehicles.length} คัน ใช้ข้ามโครงการได้
          เมื่อเปิดโครงการใหม่ ให้ <span className="font-semibold text-ink">นำเข้า</span> รายการจากที่นี่
          โครงการจะได้สำเนาของตัวเอง — แก้ไขหรือลบในโครงการไม่กระทบรายการต้นทางที่นี่
        </p>
      </section>

      <ProjectResourceManager projectId="" drivers={drivers} vehicles={vehicles} driverUsage={usage.drivers} vehicleUsage={usage.vehicles} />

      <CollapsibleSection title="เพิ่มคนขับเข้าคลังกลาง" storageKey="res.library.newdriver" defaultOpen={drivers.length === 0}>
        <CreateDriverForm />
      </CollapsibleSection>

      <CollapsibleSection title="เพิ่มรถเข้าคลังกลาง" storageKey="res.library.newvehicle" defaultOpen={vehicles.length === 0}>
        <CreateVehicleForm />
      </CollapsibleSection>
    </div>
  );
}
