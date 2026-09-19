import { notFound, redirect } from "next/navigation";
import { AirportTransferShell } from "@/components/airport-transfer/airport-transfer-shell";
import { getAirportTransferAccess } from "@/lib/airport-transfer/access";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getProjectByCode } from "@/lib/data/projects";

export const metadata = {
  title: "Airport Transfer Control — TOMP",
  description: "ศูนย์บริหารงานรับเข้าและส่งออกผู้โดยสารสนามบิน"
};

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

  const [access, profile] = await Promise.all([getAirportTransferAccess(project.id), getCurrentUserProfile()]);
  if (!access.signedIn) redirect(`/login?next=/projects/${projectCode}/airport-transfer`);
  if (!access.allowed) redirect(`/no-access?module=airport-transfer&project=${projectCode}`);

  return (
    <AirportTransferShell projectCode={projectCode} userName={profile.fullName} roleLabel={access.role || "airport_transfer"}>
      {children}
    </AirportTransferShell>
  );
}
