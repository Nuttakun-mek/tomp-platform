import { CreateMissionForm } from "@/components/missions/create-mission-form";
import { MissionListPlaceholder } from "@/components/missions/mission-list-placeholder";
import { PageHeader } from "@/components/page-header";
import { getMissionsByProjectId } from "@/lib/data/missions";
import { getProjectById } from "@/lib/data/projects";
import Link from "next/link";

interface ProjectDetailPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = await params;
  const [project, missions] = await Promise.all([
    getProjectById(projectId),
    getMissionsByProjectId(projectId)
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Project Detail"
        title={project?.projectName ?? "Project Kernel"}
        description={`Project detail for ${project?.projectCode ?? projectId}. Reads Supabase when configured and demo fallback otherwise.`}
      />
      <Link className="mb-6 inline-flex rounded-md border border-operation px-4 py-2 text-sm font-semibold text-operation" href={`/projects/${projectId}/assignments`}>
        Open assignment planning
      </Link>
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <CreateMissionForm projectId={projectId} />
        <MissionListPlaceholder missions={missions} />
      </div>
    </>
  );
}
