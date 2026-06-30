import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { AuthStatus } from "@/components/auth/auth-status";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-slate-50 text-ink">
      <div className="mx-auto grid min-h-screen w-full max-w-[1600px] lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-white/95 px-5 py-6 shadow-sm lg:block">
          <Link href="/" className="flex flex-col rounded-md border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <span className="text-sm font-semibold tracking-wide text-operation">TOMP</span>
            <span className="mt-1 text-base font-semibold leading-6">ระบบควบคุมปฏิบัติการขนส่ง</span>
            <span className="mt-3 w-fit rounded-md border border-teal-100 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">Internal Pilot</span>
          </Link>
          <div className="mt-6">
            <AppNav />
          </div>
          <div className="mt-6">
            <AuthStatus />
          </div>
        </aside>
        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur lg:hidden">
            <div className="flex flex-col gap-3 px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <Link href="/" className="flex flex-col">
                  <span className="text-sm font-semibold tracking-wide text-operation">TOMP</span>
                  <span className="text-base font-semibold">ควบคุมปฏิบัติการขนส่ง</span>
                </Link>
                <AuthStatus />
              </div>
              <AppNav />
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-8 lg:py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
