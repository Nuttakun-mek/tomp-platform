import Link from "next/link";
import { AccessDenied } from "@/components/auth/access-denied";
import { CreateMissionForm } from "@/components/missions/create-mission-form";
import { ProjectArchiveButton } from "@/components/projects/project-archive-button";
import { ProjectAssignmentBoard } from "@/components/projects/project-assignment-board";
import { ProjectChangePanel } from "@/components/projects/project-change-panel";
import { ProjectMissionBoard } from "@/components/projects/project-mission-board";
import { ProjectPublishPanel } from "@/components/projects/project-publish-panel";
import { ProjectReadinessSummary } from "@/components/projects/project-readiness-summary";
import { ProjectRenameForm } from "@/components/projects/project-rename-form";
import { ProjectWorkspaceTabs } from "@/components/projects/project-workspace-tabs";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import { StatusBadge } from "@/components/ui/status-badge";
import { combineResults } from "@/lib/data/data-result";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getMissionsByProjectId } from "@/lib/data/missions";
import { getOperationDaysByProjectId } from "@/lib/data/operation-days";
import { getProjectById } from "@/lib/data/projects";
import { getProjectMembers } from "@/lib/data/project-members";
import { getViewerAccess } from "@/lib/auth/access";
import { checkProjectPublishReadiness } from "@/lib/domain/publish-readiness";
import { formatStatusTh } from "@/lib/i18n/status-th";
import { roleLabelTh } from "@/lib/i18n/role-th";

interface ProjectPageProps {
  searchParams?: Promise<{ projectId?: string; tab?: string }>;
}

export default async function ProjectPage({ searchParams }: ProjectPageProps) {
  const params = searchParams ? await searchParams : {};
  const projectId = params.projectId || "";
  const tab = params.tab === "settings" ? "settings" : "overview";

  const project = projectId ? await getProjectById(projectId) : null;
  if (!project) {
    return (
      <AccessDenied
        title="เข้าโครงการนี้ไม่ได้"
        reason="โครงการนี้ไม่มีอยู่ หรือคุณยังไม่ได้เป็นสมาชิก ติดต่อผู้จัดการโครงการเพื่อขอสิทธิ์เข้าใช้งาน"
      />
    );
  }

  const { permissions, roleKeys } = await getViewerAccess();
  const canManage = permissions.includes("*") || roleKeys.includes("super_admin") || permissions.includes("project.update");

  return (
    <div className="grid gap-4">
      <ProjectWorkspaceTabs projectId={project.id} active="overview" />

      <section className="enterprise-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-operation">{project.projectCode}</p>
            <h1 className="mt-1 text-xl font-bold text-ink">{project.projectName}</h1>
            <p className="mt-1 text-sm text-slate-600">{project.startDate} – {project.endDate} · {project.timezone}</p>
          </div>
          <StatusBadge label={formatStatusTh(project.status)} tone={project.status === "published" || project.status === "operating" ? "ready" : "neutral"} />
        </div>
      </section>

      {tab === "settings" ? (
        <SettingsView projectId={project.id} canManage={canManage} archived={project.status === "archived"} projectName={project.projectName} />
      ) : (
        <OverviewView projectId={project.id} />
      )}
    </div>
  );
}

async function OverviewView({ projectId }: { projectId: string }) {
  const [missionsResult, assignmentsResult, operationDaysResult, project] = await Promise.all([
    getMissionsByProjectId(projectId),
    getAssignmentsByProjectId(projectId),
    getOperationDaysByProjectId(projectId),
    getProjectById(projectId)
  ]);

  const load = combineResults(missionsResult, assignmentsResult, operationDaysResult);
  if (!load.ok) {
    return <DataUnavailable description="โหลดข้อมูลภาพรวมโครงการไม่สำเร็จ" detail={load.error} />;
  }

  const missions = missionsResult.data;
  const assignments = assignmentsResult.data;
  const operationDays = operationDaysResult.data;
  const readiness = checkProjectPublishReadiness({ project, operationDays, missions, assignments });

  return (
    <div className="grid gap-4">
      {/* Summary-first: readiness + what's on the plan, then create/change
          flows folded away until needed. */}
      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr] xl:items-start">
        <div className="grid content-start gap-4">
          <ProjectReadinessSummary missions={missions.length} assignments={assignments.length} />
          <ProjectPublishPanel projectId={projectId} readiness={readiness} />
        </div>
        <div className="grid content-start gap-4">
          <ProjectAssignmentBoard projectId={projectId} assignments={assignments} />
          <ProjectMissionBoard missions={missions} />
        </div>
      </div>

      <CollapsibleSection title="เพิ่มภารกิจ" storageKey={`proj.${projectId}.newmission`} defaultOpen={missions.length === 0}>
        <CreateMissionForm projectId={projectId} />
      </CollapsibleSection>

      <CollapsibleSection title="คำขอเปลี่ยนแปลง" storageKey={`proj.${projectId}.change`} defaultOpen={false}>
        <ProjectChangePanel projectId={projectId} />
      </CollapsibleSection>
    </div>
  );
}

async function SettingsView({
  projectId,
  projectName,
  canManage,
  archived
}: {
  projectId: string;
  projectName: string;
  canManage: boolean;
  archived: boolean;
}) {
  const members = await getProjectMembers(projectId);

  return (
    <div className="grid gap-4">
      <section className="enterprise-panel grid gap-3 p-4">
        <h2 className="text-lg font-semibold text-ink">ข้อมูลโครงการ</h2>
        {canManage ? <ProjectRenameForm projectId={projectId} currentName={projectName} /> : <p className="text-sm text-slate-600">ชื่อโครงการ: {projectName}</p>}
      </section>

      <section className="enterprise-panel grid gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink">สมาชิกโครงการ ({members.length})</h2>
          {canManage ? (
            <Link href="/superadmin/users" className="text-xs font-semibold text-operation hover:underline">
              เพิ่ม/จัดการผู้ใช้
            </Link>
          ) : null}
        </div>
        {members.length ? (
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li key={m.profileId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium text-ink">{m.fullName}</span>
                  <span className="ml-2 text-xs text-slate-500">{m.email}</span>
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{roleLabelTh(m.roleKey)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">ยังไม่มีสมาชิก — เพิ่มผู้ใช้ที่หน้า “ผู้ใช้และสิทธิ์”</p>
        )}
      </section>

      {canManage ? (
        <section className="enterprise-panel grid gap-3 p-4">
          <h2 className="text-lg font-semibold text-ink">{archived ? "กู้คืนโครงการ" : "เก็บถาวรโครงการ"}</h2>
          <p className="text-sm text-slate-600">
            {archived
              ? "โครงการนี้ถูกเก็บถาวรอยู่ กู้คืนเพื่อกลับมาใช้งาน"
              : "เก็บถาวรจะซ่อนโครงการจากรายการหลัก ข้อมูลทั้งหมดยังอยู่และกู้คืนได้"}
          </p>
          <div>
            <ProjectArchiveButton projectId={projectId} archived={archived} variant="full" />
          </div>
        </section>
      ) : null}
    </div>
  );
}
