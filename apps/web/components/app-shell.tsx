import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { AuthStatus } from "@/components/auth/auth-status";
import { BuildVersionBadge } from "@/components/layout/build-version-badge";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="grid min-h-screen w-full lg:grid-cols-[320px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-slate-950 text-white shadow-command lg:block">
          <div className="sticky top-0 grid h-screen content-between gap-6 overflow-y-auto p-6">
            <div className="grid gap-6">
              <Link href="/" className="rounded-md border border-white/10 bg-white/8 p-5 shadow-command">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-sm font-semibold tracking-[0.32em] text-teal-200">TOMP</span>
                    <h1 className="mt-2 text-xl font-semibold leading-7">ศูนย์ปฏิบัติการขนส่ง</h1>
                  </div>
                  <span className="rounded-md bg-emerald-400 px-2 py-1 text-[11px] font-bold text-emerald-950">LIVE</span>
                </div>
                <div className="mt-4 rounded-md border border-white/10 bg-slate-900/80 p-3">
                  <p className="text-xs font-semibold text-slate-400">พื้นที่ทำงานปัจจุบัน</p>
                  <p className="mt-1 text-sm font-semibold text-white">Internal Pilot Operations</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-200">
                    <span className="status-pulse status-pulse-live h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    พร้อมติดตามงานและ GPS สด
                  </div>
                </div>
              </Link>

              <AppNav />
            </div>

            <div className="grid gap-3 rounded-md border border-white/10 bg-white/8 p-4">
              <EnvironmentBadge />
              <BuildVersionBadge />
              <AuthStatus />
              <p className="text-xs leading-5 text-slate-400">TOMP ใช้ GPS เพื่อมองเห็นสถานะปฏิบัติการ ไม่ใช่ระบบควบคุมคนขับ</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/92 shadow-sm backdrop-blur lg:hidden">
            <div className="grid gap-3 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <Link href="/" className="min-w-0">
                  <p className="text-xs font-semibold tracking-[0.28em] text-operation">TOMP</p>
                  <p className="truncate text-base font-semibold text-ink">ศูนย์ปฏิบัติการขนส่ง</p>
                </Link>
                <div className="grid justify-items-end gap-1">
                  <EnvironmentBadge />
                  <span className="text-[10px] font-semibold text-slate-500">v2026.07.02.0005</span>
                </div>
              </div>
              <AppNav />
            </div>
          </header>

          <WorkspaceShell>{children}</WorkspaceShell>
        </div>
      </div>
    </div>
  );
}
