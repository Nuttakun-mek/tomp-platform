import Link from "next/link";
import { CreateAssignmentForm } from "@/components/assignments/create-assignment-form";
import { DispatchBoard } from "@/components/assignments/dispatch-board";
import { EmptyState } from "@/components/ui/empty-state";
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

  if (!projects.length) {
    return (
      <EmptyState
        title="ยังไม่มีโครงการที่เข้าถึงได้"
        description="บอร์ด Assignment ทำงานต่อโครงการ เลือกโครงการก่อนเพื่อจัดสรรงาน"
        action={
          <Link href="/projects" className="rounded-command bg-operation px-4 py-2 text-sm font-semibold text-white">
            ไปหน้าโครงการ
          </Link>
        }
      />
    );
  }

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
          <div className="min-w-0">
            <p className="section-label">บอร์ด Assignment</p>
            <h1 className="page-title mt-2">{activeProject?.projectName || "เลือกโครงการเพื่อจัดสรรงาน"}</h1>
            <p className="page-description mt-2.5">เลือกโครงการให้ถูกต้องก่อนสร้าง Assignment และ QR สำหรับคนขับ</p>
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
        <CreateAssignmentForm
          projectId={projectId}
          missions={missions}
          callSigns={callSigns}
          drivers={drivers}
          vehicles={vehicles}
          existingAssignments={assignments.map((assignment) => ({
            id: assignment.id,
            driverId: assignment.driverId,
            vehicleId: assignment.vehicleId,
            startTime: assignment.startTime,
            endTime: assignment.endTime,
            label: callSigns.find((callSign) => callSign.id === assignment.callSignId)?.callSign ?? null
          }))}
        />
        <DispatchBoard projectId={projectId} assignments={assignments} missions={missions} callSigns={callSigns} drivers={drivers} vehicles={vehicles} />
      </div>
    </div>
  );
}
