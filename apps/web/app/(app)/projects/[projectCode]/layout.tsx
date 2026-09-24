import { notFound } from "next/navigation";
import { getProjectByCode } from "@/lib/data/projects";
import { getEnabledSystemKeys, getViewerSystemKeys } from "@/lib/data/project-systems";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getViewerAccess } from "@/lib/auth/access";
import { ProjectSystemTabs } from "@/components/projects/project-system-tabs";

// Same set ProjectSystemTabs itself renders — kept in one place there
// (`SYSTEM_LABEL`'s keys) and mirrored here rather than round-tripping to
// the `systems` table just to learn a list this component already hardcodes.
const ALL_SYSTEM_KEYS = ["ground_transfer", "airport_transfer"];

// The outer system-switcher shell (docs/11-codex/984/985): renders Ground
// Transfer / Airport Transfer / ตั้งค่า above whichever facet's own layout
// (ground-transfer/layout.tsx, airport-transfer/layout.tsx) is active.
// `active="ground_transfer"` below is a fallback only — a layout can't
// cleanly read its own child segment in the App Router, so
// ProjectSystemTabs resolves the real active tab client-side via
// usePathname() instead.
export default async function ProjectShellLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ projectCode: string }>;
}) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();

  const [profile, { roleKeys }] = await Promise.all([getCurrentUserProfile(), getViewerAccess()]);
  const isSuperAdmin = roleKeys.includes("super_admin");
  const [enabledSystems, viewerSystems] = await Promise.all([
    getEnabledSystemKeys(project.id),
    isSuperAdmin ? Promise.resolve(ALL_SYSTEM_KEYS) : getViewerSystemKeys(profile.id)
  ]);

  return (
    <div className="grid gap-4">
      <ProjectSystemTabs projectCode={project.projectCode} enabledSystems={enabledSystems} viewerSystems={viewerSystems} active="ground_transfer" />
      {children}
    </div>
  );
}
