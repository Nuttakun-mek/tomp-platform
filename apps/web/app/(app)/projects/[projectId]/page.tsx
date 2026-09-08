import { redirect } from "next/navigation";

interface ProjectDetailPageProps {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

// Pretty URL. Production rewrites /projects/<id> -> /project?projectId=<id> via
// vercel.json; locally we redirect so both behave the same.
export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const { projectId } = await params;
  const sp = searchParams ? await searchParams : {};
  const tab = sp.tab === "settings" ? "&tab=settings" : "";
  redirect(`/project?projectId=${encodeURIComponent(projectId)}${tab}`);
}
