import { AssignmentBoardPlaceholder } from "@/components/assignments/assignment-board-placeholder";
import { CreateAssignmentForm } from "@/components/assignments/create-assignment-form";
import { DriverAccessGenerator } from "@/components/driver/driver-access-generator";
import { PageHeader } from "@/components/page-header";
import { PublishedLockBanner } from "@/components/publish/published-lock-banner";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getCallSignsByProjectId } from "@/lib/data/call-signs";
import { getMissionsByProjectId } from "@/lib/data/missions";
import { getProjects, getProjectById } from "@/lib/data/projects";
import { getDrivers, getVehicles } from "@/lib/data/resources";
import { demoKernel } from "@/lib/demo/demo-kernel";

interface AssignmentsPageProps {
  searchParams?: Promise<{ projectId?: string }>;
}

export default async function AssignmentsPage({ searchParams }: AssignmentsPageProps) {
  const params = searchParams ? await searchParams : {};
  const projects = await getProjects();
  const projectId = params.projectId || projects[0]?.id || demoKernel.projects[0]?.id || "";
  const [project, assignments, missions, callSigns, drivers, vehicles] = await Promise.all([
    getProjectById(projectId),
    getAssignmentsByProjectId(projectId),
    getMissionsByProjectId(projectId),
    getCallSignsByProjectId(projectId),
    getDrivers(),
    getVehicles()
  ]);

  return (
    <>
      <PageHeader
        eyebrow="จัดสรรงาน"
        title="Assignment"
        description={`จัดสรรภารกิจ Call Sign คนขับ รถ และช่วงเวลาปฏิบัติงานสำหรับ ${project?.projectCode ?? projectId}`}
      />
      <PublishedLockBanner project={project} />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <CreateAssignmentForm projectId={projectId} missions={missions} callSigns={callSigns} drivers={drivers} vehicles={vehicles} />
        <div className="grid gap-6">
          <AssignmentBoardPlaceholder assignments={assignments} missions={missions} callSigns={callSigns} drivers={drivers} vehicles={vehicles} />
          <DriverAccessGenerator assignments={assignments} projectId={projectId} />
        </div>
      </div>
    </>
  );
}
