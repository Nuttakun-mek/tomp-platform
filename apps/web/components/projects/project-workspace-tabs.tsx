"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, ClipboardList, LayoutDashboard, MapPinned, Settings, Users } from "lucide-react";

type TabKey = "overview" | "dispatch" | "control" | "resources" | "settings";

export function ProjectWorkspaceTabs({ projectId, active }: { projectId: string; active: TabKey }) {
  const pathname = usePathname();
  const search = useSearchParams();
  // when rendered inside the hub page, "settings" vs "overview" comes from ?tab
  const resolvedActive: TabKey = pathname === `/projects/${projectId}` || pathname === "/project" ? (search.get("tab") === "settings" ? "settings" : "overview") : active;

  const tabs: Array<{ key: TabKey; label: string; href: string; icon: typeof LayoutDashboard }> = [
    { key: "overview", label: "ภาพรวม", href: `/projects/${projectId}`, icon: LayoutDashboard },
    { key: "dispatch", label: "จัดงาน", href: `/assignments?projectId=${projectId}`, icon: ClipboardList },
    { key: "control", label: "ศูนย์ควบคุม", href: `/mission-control?projectId=${projectId}`, icon: MapPinned },
    { key: "resources", label: "ทรัพยากร", href: `/resources?projectId=${projectId}`, icon: Users },
    { key: "settings", label: "ตั้งค่า", href: `/projects/${projectId}?tab=settings`, icon: Settings }
  ];

  return (
    <div className="grid gap-2">
      <Link href="/projects" className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-operation">
        <ArrowLeft className="h-3.5 w-3.5" /> โครงการทั้งหมด
      </Link>
      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-white p-1">
        {tabs.map((tab) => {
          const on = tab.key === resolvedActive;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                on ? "bg-operation text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
