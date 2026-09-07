import Link from "next/link";
import { CreateAssignmentForm } from "@/components/assignments/create-assignment-form";
import { DispatchBoard } from "@/components/assignments/dispatch-board";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getCallSignsByProjectId } from "@/lib/data/call-signs";
import { getMissionsByProjectId } from "@/lib/data/missions";
import { getProjects } from "@/lib/data/projects";
import { getDrivers, getVehicles } from "@/lib/data/resources";
import { demoKernel } from "@/lib/demo/demo-kernel";

interface AssignmentsPageProps {
  searchParams?: Promise<{ projectId?: string }>;
}

export default async function AssignmentsPage({ searchParams }: AssignmentsPageProps) {
  const params = searchParams ? await searchParams : {};
  const projects = await getProjects();
  const projectId = params.projectId || projects[0]?.id || demoKernel.projects[0]?.id || "";
  const activeProject = projects.find((project) => project.id === projectId) || demoKernel.projects.find((project) => project.id === projectId);
  const [assignments, missions, callSigns, drivers, vehicles] = await Promise.all([
    getAssignmentsByProjectId(projectId),
    getMissionsByProjectId(projectId),
    getCallSignsByProjectId(projectId),
    getDrivers(),
    getVehicles()
  ]);

  return (
    <div className="grid gap-5">
      <section className="enterprise-panel overflow-hidden">
        <div className="enterprise-surface p-5 lg:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="section-label">บอร์ด Assignment</p>
              <h1 className="page-title mt-2">{activeProject?.projectName || "เลือกโครงการเพื่อจัดสรรงาน"}</h1>
              <p className="page-description mt-2.5">เลือกโครงการให้ถูกต้องก่อนสร้าง Assignment และ QR สำหรับคนขับ</p>
            </div>
            <Link
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-panel bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-operation-deep"
              href="/live-test"
            >
              ทดสอบระบบจบขั้นตอน
            </Link>
          </div>
          {projects.length > 1 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  className={`rounded-card border px-3.5 py-1.5 text-[13px] font-semibold transition ${project.id === projectId ? "border-operation bg-operation-soft text-operation" : "border-border/80 bg-white text-ink-soft hover:border-operation/40"}`}
                  href={`/assignments?projectId=${project.id}`}
                >
                  {project.projectCode}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] xl:items-start">
        <CreateAssignmentForm projectId={projectId} missions={missions} callSigns={callSigns} drivers={drivers} vehicles={vehicles} />
        <DispatchBoard projectId={projectId} assignments={assignments} missions={missions} callSigns={callSigns} drivers={drivers} vehicles={vehicles} />
      </div>
    </div>
  );
}
