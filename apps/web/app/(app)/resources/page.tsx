import Link from "next/link";
import { ArrowRight, CarFront, Library } from "lucide-react";
import { ProjectWorkspaceTabs } from "@/components/projects/project-workspace-tabs";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { CreateDriverForm } from "@/components/resources/create-driver-form";
import { CreateVehicleForm } from "@/components/resources/create-vehicle-form";
import { ProjectResourceManager } from "@/components/resources/project-resource-manager";
import {
  getDrivers,
  getLibraryDrivers,
  getLibraryVehicles,
  getProjectDrivers,
  getProjectVehicles,
  getResourceUsage,
  getVehicles
} from "@/lib/data/resources";

// One page, two modes, no sub-pages repeating it.
//
//   /resources                  the central library — records kept between events
//   /resources?projectId=…      that project's own copies
//
// It used to be a hub that linked to /resources/drivers and /resources/vehicles,
// which then rendered the same "add" forms and their own stat cards. Ten
// summary tiles across three pages measured overlapping things, and the add
// form existed twice, so which copy you used decided where the record landed.

interface ResourcesPageProps {
  searchParams?: Promise<{ projectId?: string }>;
}

export default async function ResourcesPage({ searchParams }: ResourcesPageProps) {
  const params = searchParams ? await searchParams : {};
  const projectId = params.projectId || "";

  if (projectId) {
    const [drivers, vehicles, libraryDrivers, libraryVehicles] = await Promise.all([
      getProjectDrivers(projectId),
      getProjectVehicles(projectId),
      getLibraryDrivers(projectId),
      getLibraryVehicles(projectId)
    ]);

    return (
      <div className="grid gap-4">
        <ProjectWorkspaceTabs projectId={projectId} active="resources" />

        <section className="enterprise-panel-soft p-4">
          <h1 className="text-lg font-semibold text-ink">ทรัพยากรของโครงการนี้</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            คนขับ {drivers.length} คน · รถ {vehicles.length} คัน — นำเข้าจากคลังกลางหรือเพิ่มใหม่ก็ได้
            แล้วไปจับคู่เป็นหน่วยรถที่เมนู “จัดงาน”
          </p>
        </section>

        <ProjectResourceManager
          projectId={projectId}
          drivers={drivers}
          vehicles={vehicles}
          libraryDrivers={libraryDrivers}
          libraryVehicles={libraryVehicles}
        />

        <CollapsibleSection title="เพิ่มคนขับใหม่เข้าโครงการนี้" storageKey={`res.${projectId}.newdriver`} defaultOpen={drivers.length === 0}>
          <CreateDriverForm projectId={projectId} />
        </CollapsibleSection>

        <CollapsibleSection title="เพิ่มรถใหม่เข้าโครงการนี้" storageKey={`res.${projectId}.newvehicle`} defaultOpen={vehicles.length === 0}>
          <CreateVehicleForm projectId={projectId} />
        </CollapsibleSection>

        <Link
          className="smart-card group flex items-center justify-between gap-3 p-4"
          href={`/resources/vehicles?projectId=${encodeURIComponent(projectId)}`}
        >
          <span className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-ink-soft">
              <CarFront className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">มุมมองปฏิบัติการของรถ</span>
              <span className="block text-xs text-ink-soft">แผนที่ตำแหน่งรถ คิวงาน และงานคงเหลือของแต่ละคัน</span>
            </span>
          </span>
          <ArrowRight className="h-5 w-5 text-ink-faint transition group-hover:translate-x-1 group-hover:text-operation" />
        </Link>
      </div>
    );
  }

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

      <ProjectResourceManager
        projectId=""
        drivers={drivers}
        vehicles={vehicles}
        driverUsage={usage.drivers}
        vehicleUsage={usage.vehicles}
      />

      <CollapsibleSection title="เพิ่มคนขับเข้าคลังกลาง" storageKey="res.library.newdriver" defaultOpen={drivers.length === 0}>
        <CreateDriverForm />
      </CollapsibleSection>

      <CollapsibleSection title="เพิ่มรถเข้าคลังกลาง" storageKey="res.library.newvehicle" defaultOpen={vehicles.length === 0}>
        <CreateVehicleForm />
      </CollapsibleSection>
    </div>
  );
}
