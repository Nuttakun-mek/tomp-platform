import { cookies } from "next/headers";
import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { UserMenu } from "@/components/auth/user-menu";
import { BuildVersionBadge } from "@/components/layout/build-version-badge";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { ToastProvider } from "@/components/ui/toast";
import { ProjectScopePill } from "@/components/workspace/project-scope-pill";
import { getViewerAccess } from "@/lib/auth/access";
import { NAV_SECTIONS, filterNav } from "@/lib/auth/nav-model";
import { getProjects } from "@/lib/data/projects";
import { t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/server";
import { SCOPE_COOKIE, resolveActiveScope } from "@/lib/workspace/scope";

export async function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const { permissions, roleKeys, primaryRole, profile } = await getViewerAccess();
  const locale = await getRequestLocale();
  const sections = filterNav(NAV_SECTIONS, { permissions, roleKeys });
  const signedIn = Boolean(profile.authUserId) || profile.isDevelopmentFallback;

  const projects = (await getProjects()).map((project) => ({
    id: project.id,
    projectCode: project.projectCode,
    projectName: project.projectName,
    status: project.status
  }));
  const cookieStore = await cookies();
  const activeScope = resolveActiveScope(projects, cookieStore.get(SCOPE_COOKIE)?.value);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="command-panel-dark hidden rounded-none text-white lg:block" style={{ borderRadius: 0 }}>
          <div className="sticky top-0 flex h-screen flex-col overflow-y-auto border-r border-white/10 px-4 py-4">
            <Link href="/" className="group flex items-center gap-2.5 rounded-2xl px-1 py-1 transition hover:opacity-90">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-300 text-[13px] font-bold text-teal-950">T</span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold tracking-[0.28em] text-teal-200">TOMP</span>
                  <span className="block text-[12px] font-semibold leading-tight text-white">{t(locale, "app.productDescription")}</span>
                </span>
              </Link>

            <div className="mt-4">
              <ProjectScopePill projects={projects} activeId={activeScope?.id ?? null} variant="dark" />
            </div>

            <div className="mt-4 flex-1 overflow-y-auto">
              <AppNav sections={sections} locale={locale} />
            </div>

            <div className="mt-4 grid gap-2.5 border-t border-white/10 pt-4">
              <LanguageSwitcher locale={locale} variant="dark" />
              <EnvironmentBadge />
              <UserMenu name={profile.fullName} email={profile.email} roleKey={primaryRole} signedIn={signedIn} variant="dark" />
              <BuildVersionBadge />
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/94 shadow-sm backdrop-blur lg:hidden">
            <div className="grid gap-3 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <Link href="/" className="min-w-0">
                  <p className="text-[11px] font-bold tracking-[0.28em] text-operation">TOMP</p>
                  <p className="text-[13px] font-semibold leading-tight text-ink">{t(locale, "app.productDescription")}</p>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <LanguageSwitcher locale={locale} variant="light" />
                  <UserMenu name={profile.fullName} email={profile.email} roleKey={primaryRole} signedIn={signedIn} variant="light" />
                </div>
              </div>
              <ProjectScopePill projects={projects} activeId={activeScope?.id ?? null} variant="light" />
              <AppNav sections={sections} locale={locale} />
            </div>
          </header>

          <ToastProvider>
            <WorkspaceShell>{children}</WorkspaceShell>
          </ToastProvider>
        </div>
      </div>
    </div>
  );
}
