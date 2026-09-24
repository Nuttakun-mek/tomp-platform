import { cookies } from "next/headers";
import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { UserMenu } from "@/components/auth/user-menu";
import { BuildVersionBadge } from "@/components/layout/build-version-badge";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { ToastProvider } from "@/components/ui/toast";
import { ProjectScopePill } from "@/components/workspace/project-scope-pill";
import { getViewerAccess } from "@/lib/auth/access";
import { NAV_SECTIONS, filterNav } from "@/lib/auth/nav-model";
import { getVisibleProjects } from "@/lib/data/projects";
import { t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/server";
import { SCOPE_COOKIE, resolveActiveScope } from "@/lib/workspace/scope";
import { SIDEBAR_COOKIE } from "@/lib/workspace/sidebar";

export async function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const { permissions, roleKeys, primaryRole, profile } = await getViewerAccess();
  const locale = await getRequestLocale();
  const sections = filterNav(NAV_SECTIONS, { permissions, roleKeys });
  const signedIn = Boolean(profile.authUserId) || profile.isDevelopmentFallback;

  const projects = (await getVisibleProjects()).map((project) => ({
    id: project.id,
    projectCode: project.projectCode,
    projectName: project.projectName,
    status: project.status
  }));
  const cookieStore = await cookies();
  const activeScope = resolveActiveScope(projects, cookieStore.get(SCOPE_COOKIE)?.value);
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed";
  // Everything that only makes sense beside a label disappears in the icon rail.
  const hideInRail = "lg:group-data-[sidebar=collapsed]/shell:hidden";

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div
        data-sidebar={sidebarCollapsed ? "collapsed" : "expanded"}
        className="group/shell grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)] lg:data-[sidebar=collapsed]:grid-cols-[76px_minmax(0,1fr)]"
      >
        <aside className="command-panel-dark hidden rounded-none text-white lg:block">
          <div className="sticky top-0 flex h-screen flex-col overflow-y-auto border-r border-white/10 px-4 py-4 lg:group-data-[sidebar=collapsed]/shell:px-2.5">
            <Link href="/" className="group flex items-center gap-2.5 rounded-2xl px-1 py-1 transition hover:opacity-90 lg:group-data-[sidebar=collapsed]/shell:justify-center" title="TOMP">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-300 text-[13px] font-bold text-teal-950">T</span>
              <span className={`min-w-0 ${hideInRail}`}>
                <span className="block text-[11px] font-bold tracking-[0.28em] text-teal-200">TOMP</span>
                <span className="block text-[12px] font-semibold leading-tight text-white">{t(locale, "app.productShortDescription")}</span>
              </span>
            </Link>

            <div className={`mt-4 ${hideInRail}`}>
              <ProjectScopePill projects={projects} activeId={activeScope?.id ?? null} variant="dark" />
            </div>

            <div className="mt-4 flex-1 overflow-y-auto">
              <AppNav sections={sections} locale={locale} />
            </div>

            <div className="mt-4 grid gap-2.5 border-t border-white/10 pt-4">
              <div className={`grid gap-2.5 ${hideInRail}`}>
                <LanguageSwitcher locale={locale} variant="dark" />
                <EnvironmentBadge />
                <UserMenu name={profile.fullName} email={profile.email} roleKey={primaryRole} signedIn={signedIn} variant="dark" />
                <BuildVersionBadge />
              </div>
              <SidebarToggle initialCollapsed={sidebarCollapsed} />
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          {/* Only the row with the brand and the account stays pinned: the
              project picker and the menu scroll away with the page, so a phone
              keeps most of its height for the content. */}
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/94 shadow-sm backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <Link href="/" className="min-w-0">
                <p className="text-[11px] font-bold tracking-[0.28em] text-operation">TOMP</p>
                <p className="hidden truncate text-[13px] font-semibold leading-tight text-ink min-[430px]:block">{t(locale, "app.productShortDescription")}</p>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <LanguageSwitcher locale={locale} variant="light" />
                <UserMenu name={profile.fullName} email={profile.email} roleKey={primaryRole} signedIn={signedIn} variant="light" />
              </div>
            </div>
          </header>
          <div className="grid gap-2 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
            <ProjectScopePill projects={projects} activeId={activeScope?.id ?? null} variant="light" />
            <AppNav sections={sections} locale={locale} />
          </div>

          <ToastProvider>
            <WorkspaceShell>{children}</WorkspaceShell>
          </ToastProvider>
        </div>
      </div>
    </div>
  );
}
