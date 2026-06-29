import { ChangeRequestForm } from "@/components/change/change-request-form";
import { ChangeRequestList } from "@/components/change/change-request-list";
import { CreateMissionForm } from "@/components/missions/create-mission-form";
import { MissionListPlaceholder } from "@/components/missions/mission-list-placeholder";
import { PageHeader } from "@/components/page-header";
import { PublishActionCard } from "@/components/publish/publish-action-card";
import { PublishedLockBanner } from "@/components/publish/published-lock-banner";
import { PublishReadinessPanel } from "@/components/publish/publish-readiness-panel";
import { ProjectScopeCard } from "@/components/auth/project-scope-card";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getMissionsByProjectId } from "@/lib/data/missions";
import { getProjectById } from "@/lib/data/projects";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { checkProjectPublishReadiness } from "@/lib/domain/publish-readiness";
import Link from "next/link";

interface ProjectDetailPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = await params;
  const [project, missions, assignments] = await Promise.all([
    getProjectById(projectId),
    getMissionsByProjectId(projectId),
    getAssignmentsByProjectId(projectId)
  ]);
  const operationDays = project ? demoKernel.operationDays.filter((day) => day.projectId === project.id) : [];
  const readiness = checkProjectPublishReadiness({ project, operationDays, missions, assignments });

  return (
    <>
      <PageHeader
        eyebrow="Project Detail"
        title={project?.projectName ?? "Project Kernel"}
        description={`Operational workspace for ${project?.projectCode ?? projectId}. Plan, publish, and control changes from one baseline.`}
      />
      <PublishedLockBanner project={project} />
      <Link className="mb-6 inline-flex rounded-md border border-operation px-4 py-2 text-sm font-semibold text-operation" href={`/projects/${projectId}/assignments`}>
        Open assignment planning
      </Link>
      <div className="mb-6">
        <ProjectScopeCard projectId={projectId} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <CreateMissionForm projectId={projectId} />
        <MissionListPlaceholder missions={missions} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <PublishReadinessPanel readiness={readiness} />
        <PublishActionCard projectId={projectId} canPublish={readiness.canPublish} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ChangeRequestForm projectId={projectId} />
        <ChangeRequestList />
      </div>
    </>
  );
}
