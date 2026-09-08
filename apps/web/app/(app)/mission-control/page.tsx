import type { CSSProperties } from "react";
import { AssignmentMonitor } from "@/components/mission-control/assignment-monitor";
import { CommandCenterHeader } from "@/components/mission-control/command-center-header";
import { DecisionPanel } from "@/components/mission-control/decision-panel";
import { DriverSignalPanel } from "@/components/mission-control/driver-signal-panel";
import { DriverNotificationConsole } from "@/components/mission-control/driver-notification-console";
import { DriverOperationsPanel } from "@/components/mission-control/driver-operations-panel";
import { LiveMapPanel } from "@/components/mission-control/live-map-panel";
import { OperationKpiStrip } from "@/components/mission-control/operation-kpi-strip";
import { OperationTimelinePanel } from "@/components/mission-control/operation-timeline-panel";
import { ProjectSwitcher } from "@/components/mission-control/project-switcher";
import { RealtimeStatusPanel } from "@/components/mission-control/realtime-status-panel";
import { RiskAndExceptionPanel } from "@/components/mission-control/risk-and-exception-panel";
import { RouteChangeConsole } from "@/components/mission-control/route-change-console";
import { VehicleMonitorPanel } from "@/components/mission-control/vehicle-monitor-panel";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getDriverOperationSummaryByProjectId } from "@/lib/data/driver-operations";
import { getLatestDriverLocationsByProjectId, getProjectIdWithLatestDriverLocation } from "@/lib/data/locations";
import { getProjects } from "@/lib/data/projects";
import { getTimelineEventsByProjectId } from "@/lib/data/timeline";
import { getVehicleOperationProfilesByProjectId } from "@/lib/data/vehicle-operations";
import { demoProject } from "@/lib/demo/demo-kernel";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

interface MissionControlPageProps {
  searchParams?: Promise<{ projectId?: string }>;
}

export default async function MissionControlPage({ searchParams }: MissionControlPageProps) {
  const params = searchParams ? await searchParams : {};
  const [projects, latestLocationProjectId] = await Promise.all([getProjects(), params.projectId ? Promise.resolve(null) : getProjectIdWithLatestDriverLocation()]);

  if (!projects.length) {
    return (
      <EmptyState
        title="ยังไม่มีโครงการที่เข้าถึงได้"
        description="ศูนย์ควบคุมทำงานต่อโครงการ เลือกหรือรอรับมอบหมายโครงการก่อน"
        action={
          <Link href="/projects" className="rounded-command bg-operation px-4 py-2 text-sm font-semibold text-white">
            ไปหน้าโครงการ
          </Link>
        }
      />
    );
  }

  const activeProject =
    projects.find((project) => project.id === params.projectId) ??
    projects.find((project) => project.id === latestLocationProjectId) ??
    projects[0] ??
    demoProject;

  const [events, locations, assignments, driverOperations, vehicleProfiles] = await Promise.all([
    getTimelineEventsByProjectId(activeProject.id),
    getLatestDriverLocationsByProjectId(activeProject.id),
    getAssignmentsByProjectId(activeProject.id),
    getDriverOperationSummaryByProjectId(activeProject.id),
    getVehicleOperationProfilesByProjectId(activeProject.id)
  ]);

  const locationAssignmentIds = new Set(locations.map((location) => location.assignmentId).filter(Boolean));
  const followUps = assignments.filter((assignment) => !assignment.driverId || !assignment.vehicleId || !assignment.callSignId || !locationAssignmentIds.has(assignment.id)).length;
  const readiness = assignments.length ? Math.min(100, Math.round((locations.length / assignments.length) * 100)) : locations.length ? 100 : 0;

  return (
    <>
      <CommandCenterHeader project={activeProject} liveCount={locations.length} issueCount={followUps} />
      <ProjectSwitcher projects={projects} activeProjectId={activeProject.id} />
      <OperationKpiStrip readiness={readiness} assignments={assignments.length} liveDrivers={locations.length} followUps={followUps} timeline={events.length} />

      <div className="page-grid" style={{ "--rail": "380px" } as CSSProperties}>
        <div className="page-main">
          <LiveMapPanel projectId={activeProject.id} locations={locations} />
          <DriverOperationsPanel locations={locations} summary={driverOperations} />
          <AssignmentMonitor assignments={assignments} locations={locations} />
          <RiskAndExceptionPanel assignments={assignments} locations={locations} />
          <OperationTimelinePanel events={events} />
        </div>
        <aside className="page-rail">
          <DecisionPanel projectId={activeProject.id} followUps={followUps} />
          <VehicleMonitorPanel profiles={vehicleProfiles} />
          <DriverSignalPanel locations={locations} />
          <DriverNotificationConsole />
          <RouteChangeConsole />
          <RealtimeStatusPanel projectId={activeProject.id} />
        </aside>
      </div>
    </>
  );
}
