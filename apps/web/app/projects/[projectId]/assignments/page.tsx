import { CreateAssignmentForm } from "@/components/assignments/create-assignment-form";
import { DispatchBoard } from "@/components/assignments/dispatch-board";
import { PublishedLockBanner } from "@/components/publish/published-lock-banner";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getCallSignsByProjectId } from "@/lib/data/call-signs";
import { getMissionsByProjectId } from "@/lib/data/missions";
import { getProjectById } from "@/lib/data/projects";
import { getDrivers, getVehicles } from "@/lib/data/resources";

interface AssignmentsPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function AssignmentsPage({ params }: AssignmentsPageProps) {
  const { projectId } = await params;
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
      <PublishedLockBanner project={project} />
      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <CreateAssignmentForm projectId={projectId} missions={missions} callSigns={callSigns} drivers={drivers} vehicles={vehicles} />
        <DispatchBoard projectId={projectId} assignments={assignments} missions={missions} callSigns={callSigns} drivers={drivers} vehicles={vehicles} />
      </div>
    </>
  );
}
