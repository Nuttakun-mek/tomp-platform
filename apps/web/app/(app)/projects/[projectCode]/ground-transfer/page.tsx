import { AccessDenied } from "@/components/auth/access-denied";
import { ProjectChangePanel } from "@/components/projects/project-change-panel";
import { ProjectMissionBoard } from "@/components/projects/project-mission-board";
import { ProjectOperationSummaryPanel } from "@/components/projects/project-operation-summary";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { PageHeader } from "@/components/page-header";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import { StatusBadge } from "@/components/ui/status-badge";
import { combineResults } from "@/lib/data/data-result";
import { getCallSignsByProjectId } from "@/lib/data/call-signs";
import { getLatestDriverLocationsByProjectId } from "@/lib/data/locations";
import { getMissionsByProjectId } from "@/lib/data/missions";
import { getProjectByCode } from "@/lib/data/projects";
import { getProjectDrivers, getProjectVehicles } from "@/lib/data/resources";
import { summariseProjectOperation } from "@/lib/domain/project-operation-summary";
import { formatStatusTh } from "@/lib/i18n/status-th";

interface GroundTransferOverviewPageProps {
  params: Promise<{ projectCode: string }>;
}

export default async function GroundTransferOverviewPage({ params }: GroundTransferOverviewPageProps) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) {
    return (
      <AccessDenied
        title="เข้าโครงการนี้ไม่ได้"
        reason="โครงการนี้ไม่มีอยู่ หรือคุณยังไม่ได้เป็นสมาชิก ติดต่อผู้จัดการโครงการเพื่อขอสิทธิ์เข้าใช้งาน"
      />
    );
  }

  return (
    <div className="grid gap-4">
      <PageHeader
        eyebrow={project.projectCode}
        title={project.projectName}
        description={`${project.startDate} – ${project.endDate} · ${project.timezone}`}
        actions={<StatusBadge label={formatStatusTh(project.status)} tone={project.status === "published" || project.status === "operating" ? "ready" : "neutral"} />}
      />

      <OverviewView projectId={project.id} />
    </div>
  );
}

async function OverviewView({ projectId }: { projectId: string }) {
  const [missionsResult, callSignsResult, vehicles, drivers, locations] = await Promise.all([
    getMissionsByProjectId(projectId),
    getCallSignsByProjectId(projectId),
    getProjectVehicles(projectId),
    getProjectDrivers(projectId),
    getLatestDriverLocationsByProjectId(projectId)
  ]);

  const load = combineResults(missionsResult, callSignsResult);
  if (!load.ok) {
    return <DataUnavailable description="โหลดข้อมูลภาพรวมโครงการไม่สำเร็จ" detail={load.error} />;
  }

  const missions = missionsResult.data;
  const summary = summariseProjectOperation({
    vehicles,
    drivers,
    callSigns: callSignsResult.data,
    locations,
    now: Date.now()
  });

  // One column, three blocks, in the order an operator reads them: where the
  // project stands, what work is planned, what has been asked to change.
  //
  // This page used to open with a publish button that gates nothing anyone
  // uses — no project has ever been published and no driver route checks the
  // status — beside a "readiness %" that was jobs ÷ missions capped at 100, and
  // a job count already printed directly above it. None of it said anything
  // about the operation, which is what someone opening ภาพรวม came to see.
  return (
    <div className="grid gap-4">
      <ProjectOperationSummaryPanel summary={summary} />
      <ProjectMissionBoard missions={missions} />

      {/* Creating a mission moved to จัดงาน: it is the first step of planning
          work, and having it here meant the operator started on one tab and
          finished on another. ภาพรวม answers "where does this project stand". */}
      <CollapsibleSection title="คำขอเปลี่ยนแปลง" storageKey={`proj.${projectId}.change`} defaultOpen={false}>
        <ProjectChangePanel projectId={projectId} />
      </CollapsibleSection>
    </div>
  );
}
