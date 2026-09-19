import { notFound, redirect } from "next/navigation";
import { getAirportTransferAccess } from "@/lib/airport-transfer/access";
import { getProjectByCode } from "@/lib/data/projects";

// These pages live inside (app), which already supplies the full shell
// (AppShell) via apps/web/app/(app)/layout.tsx — wrapping in
// AirportTransferShell here as well produced a doubled header and a <main>
// nested inside another <main>. This layout's only job is the access gate,
// matching the precedent set by projects/[projectCode]/ground-transfer/layout.tsx.
// A page that wants the viewer's role reads getAirportTransferAccess(project.id)
// itself, the same way Ground Transfer's own pages do.
export default async function ProjectAirportTransferLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ projectCode: string }>;
}) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();

  const access = await getAirportTransferAccess(project.id);
  if (!access.signedIn) redirect(`/login?next=/projects/${projectCode}/airport-transfer`);
  if (!access.allowed) redirect(`/no-access?module=airport-transfer&project=${projectCode}`);

  return children;
}
