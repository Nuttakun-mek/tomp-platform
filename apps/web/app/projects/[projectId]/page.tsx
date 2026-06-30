import { CreateMissionForm } from "@/components/missions/create-mission-form";
import { ProjectAssignmentBoard } from "@/components/projects/project-assignment-board";
import { ProjectChangePanel } from "@/components/projects/project-change-panel";
import { ProjectMissionBoard } from "@/components/projects/project-mission-board";
import { ProjectOperationDays } from "@/components/projects/project-operation-days";
import { ProjectProgressRail } from "@/components/projects/project-progress-rail";
import { ProjectPublishPanel } from "@/components/projects/project-publish-panel";
import { ProjectReadinessSummary } from "@/components/projects/project-readiness-summary";
import { ProjectWorkspaceHeader } from "@/components/projects/project-workspace-header";
import { PublishedLockBanner } from "@/components/publish/published-lock-banner";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getMissionsByProjectId } from "@/lib/data/missions";
import { getProjectById } from "@/lib/data/projects";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { checkProjectPublishReadiness } from "@/lib/domain/publish-readiness";

interface ProjectDetailPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = await params;
  const [project, missions, assignments] = await Promise.all([getProjectById(projectId), getMissionsByProjectId(projectId), getAssignmentsByProjectId(projectId)]);
  const operationDays = project ? demoKernel.operationDays.filter((day) => day.projectId === project.id) : [];
  const readiness = checkProjectPublishReadiness({ project, operationDays, missions, assignments });

  return (
    <>
      <ProjectWorkspaceHeader project={project} />
      <PublishedLockBanner project={project} />
      <ProjectProgressRail activeIndex={assignments.length ? 2 : missions.length ? 1 : 0} />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="grid content-start gap-6">
          <ProjectReadinessSummary missions={missions.length} assignments={assignments.length} />
          <ProjectOperationDays operationDays={operationDays} />
          <ProjectAssignmentBoard projectId={projectId} assignments={assignments} />
          <ProjectPublishPanel projectId={projectId} readiness={readiness} />
        </div>
        <div className="grid content-start gap-6">
          <CreateMissionForm projectId={projectId} />
          <ProjectMissionBoard missions={missions} />
          <ProjectChangePanel projectId={projectId} />
        </div>
      </div>
    </>
  );
}
