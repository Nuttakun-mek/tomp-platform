import { CommandCenterHeader } from "@/components/mission-control/command-center-header";
import { CommsConsole } from "@/components/mission-control/comms-console";
import { FleetBoard } from "@/components/mission-control/fleet-board";
import { LiveMapPanel } from "@/components/mission-control/live-map-panel";
import { OperationKpiStrip } from "@/components/mission-control/operation-kpi-strip";
import { OperationTimelinePanel } from "@/components/mission-control/operation-timeline-panel";
import { ProjectSwitcher } from "@/components/mission-control/project-switcher";
import { RiskAndExceptionPanel } from "@/components/mission-control/risk-and-exception-panel";
import { VehicleMonitorPanel } from "@/components/mission-control/vehicle-monitor-panel";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { EmptyState } from "@/components/ui/empty-state";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getLatestAssignmentStatuses } from "@/lib/data/assignment-status";
import { getCallSignsByProjectId } from "@/lib/data/call-signs";
import { getDriverCommsByProjectId } from "@/lib/data/driver-comms";
import { getLatestDriverLocationsByProjectId, getProjectIdWithLatestDriverLocation } from "@/lib/data/locations";
import { getProjects } from "@/lib/data/projects";
import { getDrivers, getVehicles } from "@/lib/data/resources";
import { getTimelineEventsByProjectId } from "@/lib/data/timeline";
import { getVehicleEvidenceByProjectId } from "@/lib/data/vehicle-evidence";
import { getVehicleOperationProfilesByProjectId } from "@/lib/data/vehicle-operations";
import { demoProject } from "@/lib/demo/demo-kernel";
import Link from "next/link";

interface MissionControlPageProps {
  searchParams?: Promise<{ projectId?: string }>;
}

export default async function MissionControlPage({ searchParams }: MissionControlPageProps) {
  const params = searchParams ? await searchParams : {};
  const [projects, latestLocationProjectId] = await Promise.all([
    getProjects(),
    params.projectId ? Promise.resolve(null) : getProjectIdWithLatestDriverLocation()
  ]);

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

  const [events, locations, assignments, vehicleProfiles, assignmentStatuses, callSigns, comms, drivers, vehicles, evidence] = await Promise.all([
    getTimelineEventsByProjectId(activeProject.id),
    getLatestDriverLocationsByProjectId(activeProject.id),
    getAssignmentsByProjectId(activeProject.id),
    getVehicleOperationProfilesByProjectId(activeProject.id),
    getLatestAssignmentStatuses(activeProject.id),
    getCallSignsByProjectId(activeProject.id),
    getDriverCommsByProjectId(activeProject.id),
    getDrivers(),
    getVehicles(),
    getVehicleEvidenceByProjectId(activeProject.id)
  ]);

  const locationAssignmentIds = new Set(locations.map((location) => location.assignmentId).filter(Boolean));
  const followUps = assignments.filter(
    (assignment) => !assignment.driverId || !assignment.vehicleId || !assignment.callSignId || !locationAssignmentIds.has(assignment.id)
  ).length;
  const readiness = assignments.length ? Math.min(100, Math.round((locations.length / assignments.length) * 100)) : locations.length ? 100 : 0;

  return (
    <div className="grid gap-5">
      <CommandCenterHeader project={activeProject} liveCount={locations.length} issueCount={followUps} />
      <ProjectSwitcher projects={projects} activeProjectId={activeProject.id} />
      <OperationKpiStrip readiness={readiness} assignments={assignments.length} liveDrivers={locations.length} followUps={followUps} timeline={events.length} />

      <FleetBoard
        projectId={activeProject.id}
        assignments={assignments}
        callSigns={callSigns}
        drivers={drivers}
        vehicles={vehicles}
        initialLocations={locations}
        initialStatuses={assignmentStatuses}
        initialEvidence={evidence}
      />

      <CollapsibleSection title="แผนที่ติดตามตำแหน่ง" storageKey="mc.map" description="หมุดคนขับแบบเรียลไทม์ พร้อมเส้นทางและความสดของสัญญาณ">
        <LiveMapPanel projectId={activeProject.id} locations={locations} />
      </CollapsibleSection>

      <CommsConsole
        projectId={activeProject.id}
        assignments={assignments}
        callSigns={callSigns}
        initialInbound={comms.inbound}
        initialOutbound={comms.outbound}
      />

      <CollapsibleSection title="รายละเอียดรถในโครงการ" storageKey="mc.vehicles" defaultOpen={false}>
        <VehicleMonitorPanel profiles={vehicleProfiles} />
      </CollapsibleSection>

      <CollapsibleSection title="งานที่ยังขาดข้อมูล" storageKey="mc.risk" defaultOpen={false}>
        <RiskAndExceptionPanel assignments={assignments} locations={locations} />
      </CollapsibleSection>

      <CollapsibleSection title="ไทม์ไลน์ปฏิบัติการ" storageKey="mc.timeline" defaultOpen={false}>
        <OperationTimelinePanel events={events} />
      </CollapsibleSection>
    </div>
  );
}
