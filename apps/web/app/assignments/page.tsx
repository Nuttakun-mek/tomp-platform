import { CreateAssignmentForm } from "@/components/assignments/create-assignment-form";
import { DispatchBoard } from "@/components/assignments/dispatch-board";
import Link from "next/link";
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
    <div className="grid gap-6">
      <section className="enterprise-panel-soft p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-operation">บอร์ด Assignment</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">{activeProject?.projectName || "เลือกโครงการเพื่อจัดสรรงาน"}</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">เลือกโครงการให้ถูกต้องก่อนสร้าง Assignment และ QR สำหรับคนขับ</p>
          </div>
          <Link className="rounded-2xl bg-operation px-5 py-3 text-sm font-semibold text-white shadow-sm" href="/live-test">
            ทดสอบระบบจบขั้นตอน
          </Link>
        </div>
        {projects.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {projects.map((project) => (
              <Link
                key={project.id}
                className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${project.id === projectId ? "border-operation bg-teal-50 text-operation" : "border-slate-200 bg-white text-slate-700"}`}
                href={`/assignments?projectId=${project.id}`}
              >
                {project.projectCode}
              </Link>
            ))}
          </div>
        ) : null}
      </section>
      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <CreateAssignmentForm projectId={projectId} missions={missions} callSigns={callSigns} drivers={drivers} vehicles={vehicles} />
        <DispatchBoard projectId={projectId} assignments={assignments} missions={missions} callSigns={callSigns} drivers={drivers} vehicles={vehicles} />
      </div>
    </div>
  );
}
