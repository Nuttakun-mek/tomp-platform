import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { AuthStatus } from "@/components/auth/auth-status";
import { BuildVersionBadge } from "@/components/layout/build-version-badge";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="grid min-h-screen w-full lg:grid-cols-[284px_1fr]">
        <aside className="command-panel-dark hidden text-white shadow-command lg:block">
          <div className="sticky top-0 grid h-screen content-between gap-5 overflow-y-auto px-5 py-5">
            <div className="grid gap-5">
              <Link href="/" className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-command backdrop-blur transition hover:bg-white/14">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold tracking-[0.32em] text-teal-200">TOMP</span>
                    <h1 className="mt-3 text-xl font-semibold leading-7">ศูนย์ปฏิบัติการขนส่ง</h1>
                    <p className="mt-2 text-[13px] leading-6 text-slate-300">วางแผน จัดสรร ติดตาม และตัดสินใจจากข้อมูลปฏิบัติการเดียวกัน</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-300 px-3 py-1 text-[10px] font-bold text-amber-950">PILOT</span>
                </div>
                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3">
                  <p className="text-[11px] font-semibold text-slate-400">พื้นที่ทำงาน</p>
                  <p className="mt-1 text-sm font-semibold text-white">Internal Pilot Operations</p>
                  <div className="mt-2 flex items-center gap-2 text-[12px] text-emerald-200">
                    <span className="status-pulse status-pulse-live h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    พร้อมทดสอบ QR และ GPS สด
                  </div>
                </div>
              </Link>

              <AppNav />
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
              <EnvironmentBadge />
              <BuildVersionBadge />
              <AuthStatus />
              <p className="text-[12px] leading-5 text-slate-400">TOMP ใช้ GPS เพื่อมองเห็นสถานะปฏิบัติการ ไม่ใช่ระบบควบคุมคนขับ</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/94 shadow-sm backdrop-blur lg:hidden">
            <div className="grid gap-3 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <Link href="/" className="min-w-0">
                  <p className="text-[11px] font-bold tracking-[0.28em] text-operation">TOMP</p>
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
