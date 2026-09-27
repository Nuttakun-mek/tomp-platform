import { notFound } from "next/navigation";
import Link from "next/link";
import { Library } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SideDrawer } from "@/components/ui/side-drawer";
import { CreateResourcePairForm } from "@/components/resources/create-resource-pair-form";
import { ExistingResourcePairingPanel, ProjectResourceManager } from "@/components/resources/project-resource-manager";
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
      <PageHeader
        eyebrow="ทรัพยากร"
        title="ทรัพยากรของโครงการนี้"
        description={`คนขับ ${drivers.length} คน · รถ ${vehicles.length} คัน`}
        actions={
          // The two ways to make a unit, out of the page until needed: a new
          // driver and vehicle together, or a pair from what the project has.
          <SideDrawer label="เพิ่มหน่วยรถ" title="เพิ่มหน่วยรถเข้าโครงการนี้" defaultOpen={drivers.length + vehicles.length + libraryDrivers.length + libraryVehicles.length === 0}>
            <section className="enterprise-panel grid gap-3 p-4">
              <h3 className="text-sm font-semibold text-ink">คนขับและรถชุดใหม่</h3>
              <CreateResourcePairForm projectId={projectId} />
            </section>
            <ExistingResourcePairingPanel projectId={projectId} drivers={drivers} vehicles={vehicles} callSigns={callSigns} />
          </SideDrawer>
        }
      />

      {drivers.length === 0 && vehicles.length === 0 ? (
        <section className="enterprise-panel-soft border-teal-200 bg-teal-50/60 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-teal-900">
            <Library className="h-4 w-4" /> เริ่มต้นด้วยการนำเข้าทรัพยากร
          </p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-teal-900">
            แต่ละโครงการเก็บคนขับและรถเป็นสำเนาของตัวเอง
            {libraryDrivers.length + libraryVehicles.length > 0 ? (
              <> ตอนนี้คลังกลางมีคนขับ {libraryDrivers.length} คน และรถ {libraryVehicles.length} คัน กด <span className="font-semibold">“นำเข้าจากคลังกลาง”</span> ด้านล่างเพื่อดึงเข้าโครงการนี้</>
            ) : (
              <> คลังกลางยังไม่มีรายการ กด <span className="font-semibold">“เพิ่มหน่วยรถ”</span> ด้านบน หรือเพิ่มที่เมนู <Link href="/resources" className="font-semibold underline">ทรัพยากรกลาง</Link> เพื่อเก็บไว้ใช้ข้ามโครงการ</>
            )}
          </p>
        </section>
      ) : null}

      <ProjectResourceManager projectId={projectId} drivers={drivers} vehicles={vehicles} callSigns={callSigns} libraryDrivers={libraryDrivers} libraryVehicles={libraryVehicles} />

    </div>
  );
}
