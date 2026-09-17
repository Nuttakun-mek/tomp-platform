import Link from "next/link";
import { ClipboardList, FileSpreadsheet, Gauge, PlaneTakeoff, Plus, Settings } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

const items = [
  { href: "/airport-transfer", label: "ศูนย์ปฏิบัติการ", icon: Gauge },
  { href: "/airport-transfer/cases", label: "ข้อมูลการเดินทาง", icon: ClipboardList },
  { href: "/airport-transfer/cases/new", label: "สร้างการ์ดข้อมูล", icon: Plus },
  { href: "/airport-transfer/imports", label: "นำเข้า Excel", icon: FileSpreadsheet },
  { href: "/airport-transfer/settings", label: "ตั้งค่าระบบ", icon: Settings }
];

export function AirportTransferShell({ children, userName, roleLabel }: { children: React.ReactNode; userName: string; roleLabel: string }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-[#081f33] text-white">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <Link href="/airport-transfer" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300 text-[#08243a]"><PlaneTakeoff className="h-6 w-6" /></span>
            <span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-200">TOMP</span>
              <span className="block text-base font-semibold">Airport Transfer Control</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-right sm:block"><span className="block font-semibold">{userName}</span><span className="block text-xs text-slate-300">{roleLabel}</span></span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex w-full max-w-[1500px] gap-1 overflow-x-auto px-4 py-2 lg:px-6" aria-label="เมนู Airport Transfer">
          {items.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-800">
              <Icon className="h-4 w-4" />{label}
            </Link>
          ))}
        </nav>
      </div>
      <main className="mx-auto grid w-full max-w-[1500px] gap-5 px-4 py-5 lg:px-6">{children}</main>
    </div>
  );
}
