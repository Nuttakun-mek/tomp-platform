import { CreateMissionForm } from "@/components/missions/create-mission-form";
import { MissionListPlaceholder } from "@/components/missions/mission-list-placeholder";
import { PageHeader } from "@/components/page-header";
import Link from "next/link";

interface ProjectDetailPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = await params;

  return (
    <>
      <PageHeader
        eyebrow="Project Detail"
        title="Project Kernel"
        description={`Project detail placeholder for ${projectId}. Mission planning is shown as UI foundation only.`}
      />
      <Link className="mb-6 inline-flex rounded-md border border-operation px-4 py-2 text-sm font-semibold text-operation" href={`/projects/${projectId}/assignments`}>
        Open assignment planning
      </Link>
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <CreateMissionForm />
        <MissionListPlaceholder />
      </div>
    </>
  );
}
