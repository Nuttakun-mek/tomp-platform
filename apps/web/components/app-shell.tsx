import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { AuthStatus } from "@/components/auth/auth-status";
import { BuildVersionBadge } from "@/components/layout/build-version-badge";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="grid min-h-screen lg:grid-cols-[272px_minmax(0,1fr)]">
        <aside className="command-panel-dark hidden text-white lg:block">
          <div className="sticky top-0 flex h-screen flex-col overflow-y-auto border-r border-white/10 px-4 py-5">
            <Link href="/" className="group block rounded-panel border border-white/10 bg-white/[0.08] p-4 shadow-command transition hover:bg-white/[0.12]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold tracking-[0.32em] text-teal-200">TOMP</p>
                  <h1 className="mt-2.5 text-[19px] font-semibold leading-6 text-white">ศูนย์ควบคุมขนส่ง</h1>
                  <p className="mt-2 text-[12px] leading-6 text-slate-300">
                    วางแผน มอบงาน ติดตาม GPS และควบคุมการปฏิบัติการจากภาพเดียว
                  </p>
                </div>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-300 px-2.5 py-1 text-[10px] font-bold tracking-wide text-amber-950">PILOT</span>
              </div>

              <div className="mt-4 rounded-[18px] border border-white/10 bg-slate-950/40 p-3">
                <p className="text-[11px] font-semibold text-slate-400">พื้นที่ทำงาน</p>
                <p className="mt-1 text-sm font-semibold text-white">ปฏิบัติการทดสอบภายใน</p>
                <div className="mt-2 flex items-center gap-2 text-[12px] font-medium text-emerald-200">
                  <span className="status-pulse status-pulse-live h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  พร้อมทดสอบ QR และ GPS สด
                </div>
              </div>
            </Link>

            <div className="mt-5 flex-1">
              <AppNav />
            </div>

            <div className="mt-5 grid gap-3 rounded-[22px] border border-white/10 bg-white/[0.07] p-4">
              <EnvironmentBadge />
              <BuildVersionBadge />
              <AuthStatus />
              <p className="text-[11px] leading-5 text-slate-400">
                ใช้ตำแหน่งเพื่อควบคุมงานตามความยินยอมของคนขับเท่านั้น ไม่ใช่ระบบติดตามส่วนบุคคลนอกเวลางาน
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/94 shadow-sm backdrop-blur lg:hidden">
            <div className="grid gap-3 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <Link href="/" className="min-w-0">
                  <p className="text-[11px] font-bold tracking-[0.28em] text-operation">TOMP</p>
                  <p className="truncate text-base font-semibold text-ink">ศูนย์ควบคุมขนส่ง</p>
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
