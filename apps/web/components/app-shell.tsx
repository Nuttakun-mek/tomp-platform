import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { AuthStatus } from "@/components/auth/auth-status";
import { BuildVersionBadge } from "@/components/layout/build-version-badge";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="grid min-h-screen w-full lg:grid-cols-[336px_1fr]">
        <aside className="command-panel-dark hidden text-white shadow-command lg:block">
          <div className="sticky top-0 grid h-screen content-between gap-7 overflow-y-auto p-6">
            <div className="grid gap-7">
              <Link href="/" className="rounded-[28px] border border-white/10 bg-white/10 p-5 shadow-command backdrop-blur transition hover:bg-white/14">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold tracking-[0.34em] text-teal-200">TOMP</span>
                    <h1 className="mt-3 text-2xl font-semibold leading-8">ศูนย์ปฏิบัติการขนส่ง</h1>
                    <p className="mt-2 text-sm leading-6 text-slate-300">วางแผน จัดสรร ติดตาม และตัดสินใจจากข้อมูลปฏิบัติการเดียวกัน</p>
                  </div>
                  <span className="rounded-full bg-emerald-300 px-3 py-1 text-[11px] font-bold text-emerald-950">LIVE</span>
                </div>
                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-xs font-semibold text-slate-400">พื้นที่ทำงาน</p>
                  <p className="mt-1 text-sm font-semibold text-white">Internal Pilot Operations</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-200">
                    <span className="status-pulse status-pulse-live h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    พร้อมติดตามงานและ GPS สด
                  </div>
                </div>
              </Link>

              <AppNav />
            </div>

            <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/8 p-4 backdrop-blur">
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
                  <BuildVersionBadge compact />
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
