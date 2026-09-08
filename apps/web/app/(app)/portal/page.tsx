import { PageHeader } from "@/components/page-header";
import { ChangeRequestForm } from "@/components/change/change-request-form";
import { PortalMissionStatus } from "@/components/portal/portal-mission-status";
import { PortalProjectCard } from "@/components/portal/portal-project-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getMissionsByProjectId } from "@/lib/data/missions";
import { getProjects } from "@/lib/data/projects";

export default async function PortalPage() {
  const projects = await getProjects();
  const missionsByProject = await Promise.all(projects.map((project) => getMissionsByProjectId(project.id)));
  const primary = projects[0];
  const primaryMissions = missionsByProject[0] ?? [];

  return (
    <>
      <PageHeader
        eyebrow="พื้นที่ผู้จัดงาน"
        title="ภาพรวมโครงการ"
        description="ติดตามสถานะภารกิจของโครงการที่คุณเกี่ยวข้อง และส่งคำขอเปลี่ยนแปลงเข้าสู่ทีมปฏิบัติการ ไม่มีสิทธิ์แก้ไขแผนโดยตรง"
      />

      {projects.length ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project, index) => (
              <PortalProjectCard key={project.id} project={project} missions={missionsByProject[index] ?? []} />
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] xl:items-start">
            <PortalMissionStatus missions={primaryMissions} />
            {primary ? <ChangeRequestForm projectId={primary.id} /> : null}
          </div>
        </>
      ) : (
        <EmptyState
          title="ยังไม่มีโครงการที่คุณเข้าถึงได้"
          description="ติดต่อผู้ดูแลโครงการเพื่อเพิ่มคุณเข้าเป็นผู้เกี่ยวข้อง"
        />
      )}
    </>
  );
}
