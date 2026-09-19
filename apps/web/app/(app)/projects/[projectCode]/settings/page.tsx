import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/auth/access-denied";
import { ProjectDetailsForm } from "@/components/projects/project-details-form";
import { ProjectContactForm } from "@/components/projects/project-contact-form";
import { ProjectArchiveButton } from "@/components/projects/project-archive-button";
import { ProjectDeletePanel } from "@/components/projects/project-delete-panel";
import { ProjectPublishPanel } from "@/components/projects/project-publish-panel";
import { ProjectSystemToggles } from "@/components/projects/project-system-toggles";
import { ProjectMemberList } from "@/components/projects/project-member-list";
import { resolveCoordinatorPhone, resolveOperationPhone } from "@/lib/domain/contact-numbers";
import { checkProjectPublishReadiness } from "@/lib/domain/publish-readiness";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getMissionsByProjectId } from "@/lib/data/missions";
import { getOperationDaysByProjectId } from "@/lib/data/operation-days";
import { getProjectByCode } from "@/lib/data/projects";
import { getProjectMembers } from "@/lib/data/project-members";
import { getEnabledSystemKeys } from "@/lib/data/project-systems";
import { getViewerAccess } from "@/lib/auth/access";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectCode: string }> }) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();

  const { permissions, roleKeys } = await getViewerAccess();
  const canManageMembers = permissions.includes("*") || roleKeys.includes("super_admin") || permissions.includes("project.manage_members");
  const canManage = permissions.includes("*") || roleKeys.includes("super_admin") || permissions.includes("project.update");
  const canDelete = permissions.includes("*") || roleKeys.includes("super_admin") || permissions.includes("project.delete");

  if (!canManageMembers && !canManage && !canDelete) {
    return <AccessDenied title="เข้าตั้งค่าโครงการนี้ไม่ได้" reason="ต้องมีสิทธิ์จัดการโครงการนี้ก่อน ติดต่อผู้จัดการโครงการ" />;
  }

  const [members, enabledSystems, missionsResult, assignmentsResult, operationDaysResult] = await Promise.all([
    getProjectMembers(project.id),
    getEnabledSystemKeys(project.id),
    getMissionsByProjectId(project.id),
    getAssignmentsByProjectId(project.id),
    getOperationDaysByProjectId(project.id)
  ]);
  const counts = { missions: missionsResult.ok ? missionsResult.data.length : 0, assignments: assignmentsResult.ok ? assignmentsResult.data.length : 0 };

  return (
    <div className="grid gap-4">
      <section className="enterprise-panel grid gap-3 p-4">
        <h2 className="text-lg font-semibold text-ink">ข้อมูลโครงการ</h2>
        {canManage ? (
          <>
            <ProjectDetailsForm projectId={project.id} projectName={project.projectName} projectCode={project.projectCode} startDate={project.startDate} endDate={project.endDate} timezone={project.timezone} />
            <div className="border-t border-black/5 pt-3">
              <ProjectContactForm projectId={project.id} coordinatorPhone={resolveCoordinatorPhone(null, project.metadata)} operationPhone={resolveOperationPhone(null, project.metadata)} />
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-600">{project.projectName} · {project.startDate} – {project.endDate}</p>
        )}
      </section>

      <section className="enterprise-panel grid gap-3 p-4">
        <h2 className="text-lg font-semibold text-ink">ระบบที่ใช้ในโครงการนี้</h2>
        <ProjectSystemToggles projectId={project.id} enabledSystems={enabledSystems} editable={canManageMembers} />
      </section>

      <section className="enterprise-panel grid gap-3 p-4">
        <h2 className="text-lg font-semibold text-ink">สมาชิกโครงการ ({members.length})</h2>
        <ProjectMemberList projectId={project.id} members={members} enabledSystems={enabledSystems} editable={canManageMembers} />
      </section>

      {canManage ? (
        <ProjectPublishPanel
          projectId={project.id}
          readiness={checkProjectPublishReadiness({ project, operationDays: operationDaysResult.data, missions: missionsResult.data, assignments: assignmentsResult.data })}
        />
      ) : null}

      {canManage || canDelete ? (
        <section className="enterprise-panel grid gap-4 p-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">โซนอันตราย</h2>
            <p className="mt-1 text-sm text-slate-600">การกระทำในส่วนนี้ส่งผลกับทั้งโครงการ เก็บถาวรย้อนกลับได้ ลบถาวรย้อนกลับไม่ได้</p>
          </div>
          {canManage ? (
            <div className="grid gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <h3 className="text-sm font-bold text-amber-900">{project.status === "archived" ? "กู้คืนโครงการ" : "เก็บถาวรโครงการ"}</h3>
              <ProjectArchiveButton projectId={project.id} archived={project.status === "archived"} variant="full" />
            </div>
          ) : null}
          {canDelete ? <ProjectDeletePanel projectId={project.id} projectCode={project.projectCode} projectName={project.projectName} counts={counts} /> : null}
        </section>
      ) : null}
    </div>
  );
}
