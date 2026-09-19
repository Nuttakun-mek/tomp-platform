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
import { requirePermission } from "@/lib/auth/rbac";
import { getAirportTransferAccess } from "@/lib/airport-transfer/access";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectCode: string }> }) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();

  // Project-scoped, not permissions.includes(...) off account-wide
  // getViewerAccess(): that unions a profile's roles across EVERY project it
  // holds any role on, so a project_manager of project A previously
  // satisfied canManage/canDelete (and passed the entry gate below) on
  // project B despite holding no role there at all — which meant this page
  // rendered project B's full member roster (names + emails) and its
  // coordinator/operation contact numbers to them, read-only but still
  // disclosed. requirePermission(project.id, ...) checks the membership on
  // THIS project specifically, the same way every write action on this page
  // already does (toggleProjectSystemAction, addProjectMemberAction,
  // issueProjectHelperAction). super_admin still passes every one of these:
  // requirePermission falls through to getGlobalRoleKeys()'s project-id-null
  // "super_admin" role, and roleHasPermission("super_admin", ...) is true
  // for any permission via the "*" wildcard — the same bypass
  // canManageMembers already relied on before this fix.
  // Compound OR with Airport Transfer's own project-scoped manager check
  // (docs/11-codex/984 "Granting access"): the 5 Airport Transfer roles
  // inserted by migration 0044 have zero role_permissions rows on purpose
  // (access.ts checks project_members roles directly instead of going
  // through roleHasPermission()'s matrix — see 986's "role_permissions
  // wiring ... deliberately skipped"), so requirePermission() can NEVER
  // return true for an airport_admin/airport_dispatcher, no matter what.
  // Without this OR, an airport_admin on an Airport-Transfer-only project
  // sees AccessDenied on their own project's Settings tab.
  const [memberPermission, managePermission, deletePermission, airportAccess] = await Promise.all([
    requirePermission(project.id, "project.manage_members"),
    requirePermission(project.id, "project.update"),
    requirePermission(project.id, "project.delete"),
    getAirportTransferAccess(project.id)
  ]);
  const canManageMembers = memberPermission.allowed || airportAccess.canManage;
  const canManage = managePermission.allowed || airportAccess.canManage;
  const canDelete = deletePermission.allowed || airportAccess.canManage;

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
