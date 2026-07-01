import { OperationsHero } from "@/components/dashboard/operations-hero";
import { OperationsPulse } from "@/components/dashboard/operations-pulse";
import { PilotProgressPanel } from "@/components/dashboard/pilot-progress-panel";
import { QuickActionPanel } from "@/components/dashboard/quick-action-panel";
import { ReadinessOverview } from "@/components/dashboard/readiness-overview";
import { TodayOperationBoard } from "@/components/dashboard/today-operation-board";
import { CommandHeader } from "@/components/layout/command-header";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getLatestDriverLocations } from "@/lib/data/locations";
import { getProjects } from "@/lib/data/projects";
import { getTimelineEventsByProjectId } from "@/lib/data/timeline";

export default async function DashboardPage() {
  const projects = await getProjects();
  const primaryProjectId = projects[0]?.id;
  const [assignments, locations, events] = await Promise.all([
    primaryProjectId ? getAssignmentsByProjectId(primaryProjectId) : Promise.resolve([]),
    getLatestDriverLocations(10),
    primaryProjectId ? getTimelineEventsByProjectId(primaryProjectId) : Promise.resolve([])
  ]);

  const activeAssignments = assignments.filter((assignment) => ["active", "ready", "in_progress"].includes(assignment.status)).length;
  const completedAssignments = assignments.filter((assignment) => assignment.status === "completed").length;
  const followUpCount = assignments.filter((assignment) => !assignment.driverId || !assignment.vehicleId || !assignment.callSignId).length;
  const riskCount = locations.filter((location) => Date.now() - new Date(location.recordedAt).getTime() > 120000).length;
  const readinessScore = assignments.length ? Math.min(100, Math.round((locations.length / assignments.length) * 100)) : locations.length ? 100 : 0;

  return (
    <>
      <CommandHeader
        title="ภาพรวมการปฏิบัติการ"
        subtitle="มองเห็นโครงการ งานที่จัดสรร ความพร้อมของคนขับและรถ สัญญาณ GPS และรายการที่ต้องติดตามในพื้นที่เดียว"
      />
      <OperationsHero projectCount={projects.length} assignmentCount={assignments.length} gpsCount={locations.length} followUpCount={followUpCount + riskCount} />
      <OperationsPulse ready={Math.max(0, assignments.length - followUpCount - activeAssignments - completedAssignments)} followUp={followUpCount} risk={riskCount} active={activeAssignments} completed={completedAssignments} />
      <div className="grid gap-7 xl:grid-cols-[1.25fr_0.75fr]">
        <TodayOperationBoard projects={projects} latestLocation={locations[0]} latestEvent={events[0]} />
        <div className="grid gap-7">
          <ReadinessOverview score={readinessScore} gpsCount={locations.length} assignmentCount={assignments.length} />
          <QuickActionPanel />
        </div>
      </div>
      <PilotProgressPanel />
    </>
  );
}
