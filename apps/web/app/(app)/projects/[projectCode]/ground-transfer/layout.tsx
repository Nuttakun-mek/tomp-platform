import { notFound } from "next/navigation";
import { getProjectByCode } from "@/lib/data/projects";

export default async function GroundTransferProjectLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ projectCode: string }>;
}) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();
  return children;
}
