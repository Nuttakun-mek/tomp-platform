import { notFound, redirect } from "next/navigation";
import { CreateAssignmentForm } from "@/components/assignments/create-assignment-form";
import { DriverJobOrderPanel } from "@/components/assignments/driver-job-order-panel";
import { PageHeader } from "@/components/page-header";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import { combineResults } from "@/lib/data/data-result";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getCallSignsByProjectId } from "@/lib/data/call-signs";
import { getMissionsByProjectId } from "@/lib/data/missions";
import { getObserverLinksByProjectId, getProjectObserverLinkByProjectId } from "@/lib/data/observer-access";
import { getProjectByCode } from "@/lib/data/projects";
import { getProjectDrivers, getProjectVehicles } from "@/lib/data/resources";
import { getVehicleEvidenceByProjectId } from "@/lib/data/vehicle-evidence";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { DispatchWorkspace } from "@/components/assignments/dispatch-workspace";

interface DispatchPageProps {
  params: Promise<{ projectCode: string }>;
}

export default async function DispatchPage({ params }: DispatchPageProps) {
  const { projectCode } = await params;
  const viewer = await getCurrentUserProfile();
  if (!viewer.authUserId && !viewer.isDevelopmentFallback) redirect("/login");
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();
  const projectId = project.id;
  const [assignmentsResult, missionsResult, callSignsResult, drivers, vehicles, observerLinks, projectObserverLink, vehicleEvidence] = await Promise.all([
    getAssignmentsByProjectId(projectId),
    getMissionsByProjectId(projectId),
    getCallSignsByProjectId(projectId),
    getProjectDrivers(projectId),
    getProjectVehicles(projectId),
    // Read on the server so the passenger QR is on screen at load, not only in
    // the tab that issued it.
    getObserverLinksByProjectId(projectId),
    getProjectObserverLinkByProjectId(projectId),
    getVehicleEvidenceByProjectId(projectId)
  ]);

  const load = combineResults(assignmentsResult, missionsResult, callSignsResult);
  const assignments = assignmentsResult.data;
  const missions = missionsResult.data;
  const callSigns = callSignsResult.data;

  return (
    <div data-wide className="grid gap-4">
      <PageHeader
        eyebrow="จัดการโครงการ"
        title={project.projectName}
        description="จัดการหน่วยรถ เปิดงานให้คนขับ และออก QR สำหรับการปฏิบัติงาน ส่วนการติดตามเวลาและความเสี่ยง OT อยู่ที่ศูนย์ควบคุม"
      />
      {!load.ok ? <DataUnavailable description="โหลดข้อมูลงานของโครงการนี้ไม่สำเร็จ" detail={load.error} /> : null}
      {/* The page reads down the way the work happens: set a unit up, open work
          onto it, then watch the board. Each block is full width — the old
          two-column split put the form beside the board and left both narrow. */}
      <DispatchWorkspace
        projectId={projectId}
        projectCode={project.projectCode}
        callSigns={callSigns}
        missions={missions}
        drivers={drivers}
        vehicles={vehicles}
        assignments={assignments}
        observerLinks={observerLinks}
        projectObserverLink={projectObserverLink}
        vehicleEvidence={vehicleEvidence}
        projectStartDate={project.startDate}
        projectEndDate={project.endDate}
        jobForm={
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
        }
      />

      <DriverJobOrderPanel projectId={projectId} assignments={assignments} callSigns={callSigns} drivers={drivers} />
    </div>
  );
}
