import { notFound, redirect } from "next/navigation";
import { CommandCenterHeader } from "@/components/mission-control/command-center-header";
import { CommsConsole } from "@/components/mission-control/comms-console";
import { FleetBoard } from "@/components/mission-control/fleet-board";
import { LiveLocationMap } from "@/components/mission-control/live-location-map";
import { MissionControlFeedProvider } from "@/components/mission-control/mission-control-feed";
import { OperationTimelinePanel } from "@/components/mission-control/operation-timeline-panel";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import { combineResults } from "@/lib/data/data-result";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getAssignmentWorkSessions, getLatestAssignmentStatuses } from "@/lib/data/assignment-status";
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

  const [eventsResult, locations, assignmentsResult, assignmentStatuses, workSessions, callSignsResult, comms, drivers, vehicles, evidence, missionsResult] = await Promise.all([
    getTimelineEventsByProjectId(project.id),
    getLatestDriverLocationsByProjectId(project.id),
    getAssignmentsByProjectId(project.id),
    getLatestAssignmentStatuses(project.id),
    getAssignmentWorkSessions(project.id),
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


  return (
    <div className="grid gap-4">
      {!load.ok ? <DataUnavailable description="โหลดข้อมูลศูนย์ควบคุมบางส่วนไม่สำเร็จ" detail={load.error} /> : null}
      {/* The counts that used to sit here (header pills, a KPI strip with a
          "readiness %" of positions ÷ jobs) repeated the fleet board's chips,
          which now also filter the cards. */}
      <CommandCenterHeader project={project} />

      {/* One shared live feed for the map, the fleet board and the comms console —
          one poll of /locations + /comms per cycle instead of three. */}
      <MissionControlFeedProvider
        projectId={project.id}
        initialLocations={locations}
        initialComms={{ inbound: comms.inbound, outbound: comms.outbound, statuses: assignmentStatuses, workSessions, evidence }}
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
          listView={
            <JobStatusBoard assignments={assignments} missions={missions} callSigns={callSigns} drivers={drivers} vehicles={vehicles} />
          }
        />

        <CommsConsole projectId={project.id} assignments={assignments} callSigns={callSigns} />
      </MissionControlFeedProvider>

      {/* "สถานะงานทั้งหมด" is the fleet board's "ดูแบบรายการ" now, and
          "งานที่ยังขาดข้อมูล" went: every card is a crewed Call Sign, and a
          missing GPS signal is already the card's colour. */}
      <CollapsibleSection title="ไทม์ไลน์ปฏิบัติการ" storageKey="mc.timeline" defaultOpen={false}>
        <OperationTimelinePanel events={events} />
      </CollapsibleSection>
    </div>
  );
}
