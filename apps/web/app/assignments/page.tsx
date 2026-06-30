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
  const [assignments, missions, callSigns, drivers, vehicles] = await Promise.all([
    getAssignmentsByProjectId(projectId),
    getMissionsByProjectId(projectId),
    getCallSignsByProjectId(projectId),
    getDrivers(),
    getVehicles()
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
      <CreateAssignmentForm projectId={projectId} missions={missions} callSigns={callSigns} drivers={drivers} vehicles={vehicles} />
      <DispatchBoard projectId={projectId} assignments={assignments} missions={missions} callSigns={callSigns} drivers={drivers} vehicles={vehicles} />
    </div>
  );
}
