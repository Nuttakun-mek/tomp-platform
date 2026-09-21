"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ClipboardList, LayoutDashboard, MapPinned, Users } from "lucide-react";

type TabKey = "overview" | "dispatch" | "control" | "resources";

export function ProjectWorkspaceTabs({ projectCode, active }: { projectCode: string; active: TabKey }) {
  const pathname = usePathname();
  const base = `/projects/${projectCode}/ground-transfer`;

  const tabs: Array<{ key: TabKey; label: string; href: string; icon: typeof LayoutDashboard }> = [
    { key: "overview", label: "ภาพรวม", href: base, icon: LayoutDashboard },
    { key: "dispatch", label: "จัดการโครงการ", href: `${base}/dispatch`, icon: ClipboardList },
    { key: "control", label: "ศูนย์ควบคุม", href: `${base}/control`, icon: MapPinned },
    { key: "resources", label: "ทรัพยากร", href: `${base}/resources`, icon: Users }
  ];

  const resolvedActive: TabKey = tabs.find((tab) => tab.href === pathname)?.key ?? active;

  return (
    <div className="grid gap-2">
      <Link href="/projects" className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-operation">
        <ArrowLeft className="h-3.5 w-3.5" /> โครงการทั้งหมด
      </Link>
      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-white p-1">
        {tabs.map((tab) => {
          const on = tab.key === resolvedActive;
          return (
            <Link key={tab.key} href={tab.href} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${on ? "bg-operation text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
