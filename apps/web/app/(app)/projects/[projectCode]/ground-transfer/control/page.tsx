import { notFound, redirect } from "next/navigation";
import { CommandCenterHeader } from "@/components/mission-control/command-center-header";
import { CommsConsole } from "@/components/mission-control/comms-console";
import { FleetBoard } from "@/components/mission-control/fleet-board";
import { LiveLocationMap } from "@/components/mission-control/live-location-map";
import { MissionControlFeedProvider } from "@/components/mission-control/mission-control-feed";
import { OperationKpiStrip } from "@/components/mission-control/operation-kpi-strip";
import { OperationTimelinePanel } from "@/components/mission-control/operation-timeline-panel";
import { RiskAndExceptionPanel } from "@/components/mission-control/risk-and-exception-panel";
import { ProjectWorkspaceTabs } from "@/components/projects/project-workspace-tabs";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import { combineResults } from "@/lib/data/data-result";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getLatestAssignmentStatuses } from "@/lib/data/assignment-status";
import { getCallSignsByProjectId } from "@/lib/data/call-signs";
import { getDriverCommsByProjectId } from "@/lib/data/driver-comms";
import { getLatestDriverLocationsByProjectId } from "@/lib/data/locations";
import { getProjectByCode } from "@/lib/data/projects";
import { getProjectDrivers, getProjectVehicles } from "@/lib/data/resources";
import { getTimelineEventsByProjectId } from "@/lib/data/timeline";
import { getVehicleEvidenceByProjectId } from "@/lib/data/vehicle-evidence";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { JobStatusBoard } from "@/components/mission-control/job-status-board";
import { getMissionsByProjectId } from "@/lib/data/missions";

interface ControlPageProps {
  params: Promise<{ projectCode: string }>;
}

export default async function ControlPage({ params }: ControlPageProps) {
  const { projectCode } = await params;
  const viewer = await getCurrentUserProfile();
  if (!viewer.authUserId && !viewer.isDevelopmentFallback) redirect("/login");
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();

  const [eventsResult, locations, assignmentsResult, assignmentStatuses, callSignsResult, comms, drivers, vehicles, evidence, missionsResult] = await Promise.all([
    getTimelineEventsByProjectId(project.id),
    getLatestDriverLocationsByProjectId(project.id),
    getAssignmentsByProjectId(project.id),
    getLatestAssignmentStatuses(project.id),
    getCallSignsByProjectId(project.id),
    getDriverCommsByProjectId(project.id),
    getProjectDrivers(project.id),
    getProjectVehicles(project.id),
    getVehicleEvidenceByProjectId(project.id),
    getMissionsByProjectId(project.id)
  ]);

  const missions = missionsResult.data;
  const load = combineResults(eventsResult, assignmentsResult, callSignsResult);
  const events = eventsResult.data;
  const assignments = assignmentsResult.data;
  const callSigns = callSignsResult.data;

  const locationAssignmentIds = new Set(locations.map((location) => location.assignmentId).filter(Boolean));
  const followUps = assignments.filter(
    (assignment) => !assignment.driverId || !assignment.vehicleId || !assignment.callSignId || !locationAssignmentIds.has(assignment.id)
  ).length;
  const readiness = assignments.length ? Math.min(100, Math.round((locations.length / assignments.length) * 100)) : locations.length ? 100 : 0;

  return (
    <div className="grid gap-4">
      <ProjectWorkspaceTabs projectCode={project.projectCode} active="control" />
      {!load.ok ? <DataUnavailable description="โหลดข้อมูลศูนย์ควบคุมบางส่วนไม่สำเร็จ" detail={load.error} /> : null}
      <CommandCenterHeader project={project} liveCount={locations.length} issueCount={followUps} />
      <OperationKpiStrip readiness={readiness} assignments={assignments.length} liveDrivers={locations.length} followUps={followUps} timeline={events.length} />

      {/* One shared live feed for the map, the fleet board and the comms console —
          one poll of /locations + /comms per cycle instead of three. */}
      <MissionControlFeedProvider
        projectId={project.id}
        initialLocations={locations}
        initialComms={{ inbound: comms.inbound, outbound: comms.outbound, statuses: assignmentStatuses, evidence }}
      >
        <CollapsibleSection
          title="แผนที่ติดตามตำแหน่ง"
          storageKey="mc.map"
          description="หมุดคนขับแบบเรียลไทม์ พร้อมเส้นทางและความสดของสัญญาณ"
          defaultOpen={locations.length > 0}
        >
          <LiveLocationMap projectId={project.id} initialLocations={locations} />
        </CollapsibleSection>

        <FleetBoard
          projectId={project.id}
          assignments={assignments}
          callSigns={callSigns}
          drivers={drivers}
          vehicles={vehicles}
        />

        <CommsConsole projectId={project.id} assignments={assignments} callSigns={callSigns} />
      </MissionControlFeedProvider>

      <CollapsibleSection title="สถานะงานทั้งหมด" storageKey="mc.jobstatus" defaultOpen>
        <JobStatusBoard
          assignments={assignments}
          missions={missions}
          callSigns={callSigns}
          drivers={drivers}
          vehicles={vehicles}
        />
      </CollapsibleSection>

      {/* "รายละเอียดรถในโครงการ" is gone. It listed the same units as the fleet
          board keyed by vehicle instead of by driver, and a Call Sign is one
          driver in one vehicle, so the two lists had the same rows. Its data
          call also ran on every load despite the section defaulting to closed,
          fanning out to every project, every driver, 100 locations, missions,
          and per-project status and evidence lookups. */}
      <CollapsibleSection title="งานที่ยังขาดข้อมูล" storageKey="mc.risk" defaultOpen={false}>
        <RiskAndExceptionPanel assignments={assignments} locations={locations} />
      </CollapsibleSection>

      <CollapsibleSection title="ไทม์ไลน์ปฏิบัติการ" storageKey="mc.timeline" defaultOpen={false}>
        <OperationTimelinePanel events={events} />
      </CollapsibleSection>
    </div>
  );
}
