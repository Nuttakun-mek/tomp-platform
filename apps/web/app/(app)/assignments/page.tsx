import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateAssignmentForm } from "@/components/assignments/create-assignment-form";
import { DispatchBoard } from "@/components/assignments/dispatch-board";
import { ProjectWorkspaceTabs } from "@/components/projects/project-workspace-tabs";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import { EmptyState } from "@/components/ui/empty-state";
import { combineResults } from "@/lib/data/data-result";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getCallSignsByProjectId } from "@/lib/data/call-signs";
import { getMissionsByProjectId } from "@/lib/data/missions";
import { getProjects } from "@/lib/data/projects";
import { getDrivers, getVehicles } from "@/lib/data/resources";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { CreateMissionForm } from "@/components/missions/create-mission-form";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

interface AssignmentsPageProps {
  searchParams?: Promise<{ projectId?: string }>;
}

export default async function AssignmentsPage({ searchParams }: AssignmentsPageProps) {
  const params = searchParams ? await searchParams : {};
  const viewer = await getCurrentUserProfile();
  if (!viewer.authUserId && !viewer.isDevelopmentFallback) redirect("/login");
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

  const activeProject = projects.find((project) => project.id === params.projectId);
  if (!activeProject) {
    if (projects.length === 1) redirect(`/assignments?projectId=${projects[0].id}`);
    redirect("/projects");
  }
  const projectId = activeProject.id;
  const [assignmentsResult, missionsResult, callSignsResult, drivers, vehicles] = await Promise.all([
    getAssignmentsByProjectId(projectId),
    getMissionsByProjectId(projectId),
    getCallSignsByProjectId(projectId),
    getDrivers(),
    getVehicles()
  ]);

  const load = combineResults(assignmentsResult, missionsResult, callSignsResult);
  const assignments = assignmentsResult.data;
  const missions = missionsResult.data;
  const callSigns = callSignsResult.data;

  return (
    <div className="grid gap-4">
      <ProjectWorkspaceTabs projectId={projectId} active="dispatch" />
      <section className="enterprise-panel overflow-hidden">
        <div className="enterprise-surface p-4 lg:p-5">
          <div className="min-w-0">
            <p className="section-label">จัดงาน</p>
            <h1 className="page-title mt-2">{activeProject.projectName}</h1>
            <p className="page-description mt-2.5">สร้าง Assignment มอบให้ Call Sign คนขับ และรถ แล้วออก QR เฉพาะงาน</p>
          </div>
        </div>
      </section>
      {!load.ok ? <DataUnavailable description="โหลดข้อมูลงานของโครงการนี้ไม่สำเร็จ" detail={load.error} /> : null}
      {/* Planning reads top to bottom: create the mission, then assign work to
          it, then watch the board. Folded away once the project has missions. */}
      <CollapsibleSection title="เพิ่มภารกิจ" storageKey={`proj.${projectId}.newmission`} defaultOpen={missions.length === 0}>
        <CreateMissionForm projectId={projectId} />
      </CollapsibleSection>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] xl:items-start">
        <CreateAssignmentForm
          projectId={projectId}
          projectCode={activeProject.projectCode}
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
