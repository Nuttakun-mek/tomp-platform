import { redirect } from "next/navigation";

interface AssignmentsPageProps {
  params: Promise<{ projectId: string }>;
}

// Pretty URL. Production rewrites this to /assignments?projectId=<id> via
// vercel.json; locally we redirect so both behave the same.
export default async function AssignmentsPage({ params }: AssignmentsPageProps) {
  const { projectId } = await params;
  redirect(`/assignments?projectId=${encodeURIComponent(projectId)}`);
}
