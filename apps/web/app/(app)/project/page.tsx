import Link from "next/link";
import { AccessDenied } from "@/components/auth/access-denied";
import { ProjectArchiveButton } from "@/components/projects/project-archive-button";
import { ProjectDeletePanel } from "@/components/projects/project-delete-panel";
import { ProjectAssignmentBoard } from "@/components/projects/project-assignment-board";
import { ProjectChangePanel } from "@/components/projects/project-change-panel";
import { ProjectMissionBoard } from "@/components/projects/project-mission-board";
import { ProjectPublishPanel } from "@/components/projects/project-publish-panel";
import { ProjectReadinessSummary } from "@/components/projects/project-readiness-summary";
import { ProjectRenameForm } from "@/components/projects/project-rename-form";
import { ProjectContactForm } from "@/components/projects/project-contact-form";
import { resolveCoordinatorPhone, resolveOperationPhone } from "@/lib/domain/contact-numbers";
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
  // Deleting is not the same authority as editing: a dispatcher may reschedule
  // work without being able to erase the project it belongs to.
  const canDelete = permissions.includes("*") || roleKeys.includes("super_admin") || permissions.includes("project.delete");

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
        <SettingsView
          projectId={project.id}
          canManage={canManage}
          canDelete={canDelete}
          archived={project.status === "archived"}
          projectName={project.projectName}
          projectCode={project.projectCode}
          projectMetadata={project.metadata}
        />
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

      {/* Creating a mission moved to จัดงาน: it is the first step of planning
          work, and having it here meant the operator started on one tab and
          finished on another. ภาพรวม answers "where does this project stand". */}
      <CollapsibleSection title="คำขอเปลี่ยนแปลง" storageKey={`proj.${projectId}.change`} defaultOpen={false}>
        <ProjectChangePanel projectId={projectId} />
      </CollapsibleSection>
    </div>
  );
}

async function SettingsView({
  projectId,
  projectName,
  projectCode,
  projectMetadata,
  canManage,
  canDelete,
  archived
}: {
  projectId: string;
  projectName: string;
  projectCode: string;
  projectMetadata: Record<string, unknown>;
  canManage: boolean;
  canDelete: boolean;
  archived: boolean;
}) {
  const [members, missionsResult, assignmentsResult] = await Promise.all([
    getProjectMembers(projectId),
    getMissionsByProjectId(projectId),
    getAssignmentsByProjectId(projectId)
  ]);
  // Shown in the delete confirmation: "this many jobs" makes the scale of the
  // action concrete in a way the project name alone does not.
  const counts = {
    missions: missionsResult.ok ? missionsResult.data.length : 0,
    assignments: assignmentsResult.ok ? assignmentsResult.data.length : 0
  };

  return (
    <div className="grid gap-4">
      <section className="enterprise-panel grid gap-3 p-4">
        <h2 className="text-lg font-semibold text-ink">ข้อมูลโครงการ</h2>
        {canManage ? <ProjectRenameForm projectId={projectId} currentName={projectName} /> : <p className="text-sm text-slate-600">ชื่อโครงการ: {projectName}</p>}
        {canManage ? (
          <div className="border-t border-black/5 pt-3">
            <ProjectContactForm
              projectId={projectId}
              coordinatorPhone={resolveCoordinatorPhone(null, projectMetadata)}
              operationPhone={resolveOperationPhone(null, projectMetadata)}
            />
          </div>
        ) : null}
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

      {canManage || canDelete ? (
        <section className="enterprise-panel grid gap-4 p-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">โซนอันตราย</h2>
            <p className="mt-1 text-sm text-slate-600">
              การกระทำในส่วนนี้ส่งผลกับทั้งโครงการ เก็บถาวรย้อนกลับได้ ลบถาวรย้อนกลับไม่ได้
            </p>
          </div>

          {canManage ? (
            <div className="grid gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <h3 className="text-sm font-bold text-amber-900">{archived ? "กู้คืนโครงการ" : "เก็บถาวรโครงการ"}</h3>
              <p className="text-sm leading-6 text-amber-800">
                {archived
                  ? "โครงการนี้ถูกเก็บถาวรอยู่ กู้คืนเพื่อกลับมาใช้งาน"
                  : "ซ่อนโครงการจากรายการหลัก ข้อมูลทั้งหมดยังอยู่และกู้คืนได้ทุกเมื่อ"}
              </p>
              <div className="mt-1">
                <ProjectArchiveButton projectId={projectId} archived={archived} variant="full" />
              </div>
            </div>
          ) : null}

          {canDelete ? (
            <ProjectDeletePanel
              projectId={projectId}
              projectCode={projectCode}
              projectName={projectName}
              counts={counts}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
