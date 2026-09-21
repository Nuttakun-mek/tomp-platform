import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CarFront, Library } from "lucide-react";
import { ProjectWorkspaceTabs } from "@/components/projects/project-workspace-tabs";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { CreateResourcePairForm } from "@/components/resources/create-resource-pair-form";
import { ProjectResourceManager } from "@/components/resources/project-resource-manager";
import { getCallSignsByProjectId } from "@/lib/data/call-signs";
import { getProjectByCode } from "@/lib/data/projects";
import { getLibraryDrivers, getLibraryVehicles, getProjectDrivers, getProjectVehicles } from "@/lib/data/resources";

export default async function ProjectResourcesPage({ params }: { params: Promise<{ projectCode: string }> }) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();
  const projectId = project.id;

  const [drivers, vehicles, libraryDrivers, libraryVehicles, callSignsResult] = await Promise.all([
    getProjectDrivers(projectId),
    getProjectVehicles(projectId),
    getLibraryDrivers(projectId),
    getLibraryVehicles(projectId),
    getCallSignsByProjectId(projectId)
  ]);
  const callSigns = callSignsResult.data;

  return (
    <div className="grid gap-4">
      <ProjectWorkspaceTabs projectCode={project.projectCode} active="resources" />

      <section className="enterprise-panel-soft p-4">
        <h1 className="text-lg font-semibold text-ink">ทรัพยากรของโครงการนี้</h1>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          คนขับ {drivers.length} คน · รถ {vehicles.length} คัน — นำเข้าจากคลังกลางหรือเพิ่มใหม่ก็ได้
          หากเพิ่มเป็นคู่ ระบบจะสร้างหน่วยรถให้พร้อมใช้ในเมนู “จัดการโครงการ”
        </p>
      </section>

      {drivers.length === 0 && vehicles.length === 0 ? (
        <section className="enterprise-panel-soft border-teal-200 bg-teal-50/60 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-teal-900">
            <Library className="h-4 w-4" /> เริ่มต้นด้วยการนำเข้าทรัพยากร
          </p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-teal-900">
            โครงการเก็บคนขับและรถเป็นสำเนาของตัวเอง เพื่อให้สถานะและการแก้ไขไม่ข้ามไปโครงการอื่น
            โครงการนี้จึงยังว่างอยู่ — ไม่ใช่ข้อมูลหาย
            {libraryDrivers.length + libraryVehicles.length > 0 ? (
              <> ตอนนี้คลังกลางมีคนขับ {libraryDrivers.length} คน และรถ {libraryVehicles.length} คัน กด <span className="font-semibold">“นำเข้าจากคลังกลาง”</span> ด้านล่างเพื่อดึงเข้าโครงการนี้</>
            ) : (
              <> คลังกลางยังไม่มีรายการ เพิ่มคนขับและรถได้ที่ด้านล่าง หรือที่เมนู <Link href="/resources" className="font-semibold underline">ทรัพยากรกลาง</Link> เพื่อเก็บไว้ใช้ข้ามโครงการ</>
            )}
          </p>
        </section>
      ) : null}

      <ProjectResourceManager projectId={projectId} drivers={drivers} vehicles={vehicles} callSigns={callSigns} libraryDrivers={libraryDrivers} libraryVehicles={libraryVehicles} />

      <CollapsibleSection
        title="เพิ่มคนขับและรถเข้าโครงการนี้"
        description="สร้างข้อมูลเป็นคู่เดียวกัน แล้วระบบจะสร้างหน่วยรถให้พร้อมเปิดงานและออก QR ในหน้าจัดการโครงการ"
        storageKey={`res.${projectId}.newpair`}
        defaultOpen={drivers.length === 0 || vehicles.length === 0}
      >
        <CreateResourcePairForm projectId={projectId} />
      </CollapsibleSection>

      <Link className="smart-card group flex items-center justify-between gap-3 p-4" href={`/resources/vehicles?projectId=${encodeURIComponent(projectId)}`}>
        <span className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-ink-soft"><CarFront className="h-5 w-5" /></span>
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
