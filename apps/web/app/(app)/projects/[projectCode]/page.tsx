import { redirect, notFound } from "next/navigation";
import { getProjectByCode } from "@/lib/data/projects";
import { getEnabledSystemKeys } from "@/lib/data/project-systems";

export default async function ProjectRootPage({ params }: { params: Promise<{ projectCode: string }> }) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();

  const enabled = await getEnabledSystemKeys(project.id);
  if (enabled.includes("ground_transfer")) redirect(`/projects/${projectCode}/ground-transfer`);
  if (enabled.includes("airport_transfer")) redirect(`/projects/${projectCode}/airport-transfer`);
  redirect(`/projects/${projectCode}/settings`);
}
