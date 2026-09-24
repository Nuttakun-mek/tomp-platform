"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, CarFront, Lock, PlaneTakeoff, Settings } from "lucide-react";
import { groundTransferTabs } from "./project-workspace-tabs";

type SystemKey = "ground_transfer" | "airport_transfer";
type OuterTabKey = SystemKey | "settings";

const SYSTEM_LABEL: Record<SystemKey, string> = { ground_transfer: "Ground Transfer", airport_transfer: "Airport Transfer" };
const SYSTEM_ICON: Record<SystemKey, typeof CarFront> = { ground_transfer: CarFront, airport_transfer: PlaneTakeoff };
const SYSTEM_SEGMENT: Record<SystemKey, string> = { ground_transfer: "ground-transfer", airport_transfer: "airport-transfer" };

const TAB = "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition";

// The project's one navigation bar: back to all projects, the systems, settings,
// and — inside Ground Transfer — its sections. These used to be three stacked
// pieces (this bar, a back link, and a second tab bar on every Ground Transfer
// page) before any content. One row now; it scrolls sideways on a narrow screen
// rather than wrapping into several.
export function ProjectSystemTabs({
  projectCode,
  enabledSystems,
  viewerSystems,
  active
}: {
  projectCode: string;
  enabledSystems: string[];
  viewerSystems: string[];
  active: OuterTabKey;
}) {
  const systems: SystemKey[] = ["ground_transfer", "airport_transfer"];

  // A layout can't cleanly read its own child segment in the App Router, so the
  // wrapper always passes active="ground_transfer"; the pathname resolves it.
  const pathname = usePathname();
  const resolvedActive: OuterTabKey = resolveActiveFromPathname(pathname, projectCode) ?? active;
  const sections = resolvedActive === "ground_transfer" ? groundTransferTabs(projectCode) : [];
  const activeSection = sections.find((tab) => tab.href === pathname)?.key ?? "overview";

  return (
    <nav aria-label="เมนูโครงการ" className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-white p-1">
      <Link href="/projects" className={`${TAB} text-slate-500 hover:bg-slate-100 hover:text-operation`} title="โครงการทั้งหมด">
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">โครงการทั้งหมด</span>
      </Link>
      <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />

      {systems.map((key) => {
        const Icon = SYSTEM_ICON[key];
        const enabled = enabledSystems.includes(key);
        const accessible = viewerSystems.includes(key);
        const on = resolvedActive === key;

        if (!enabled || !accessible) {
          // The reason goes in the tooltip, not the bar: two long parentheticals
          // used to push the real tabs onto a second line.
          const reason = !enabled ? "ยังไม่เปิดใช้ในโครงการนี้" : "ไม่มีสิทธิ์เข้าระบบนี้ในโครงการนี้";
          return (
            <span key={key} className={`${TAB} cursor-not-allowed text-slate-400`} title={reason} aria-disabled="true">
              <Icon className="h-4 w-4" /> {SYSTEM_LABEL[key]} <Lock className="h-3.5 w-3.5" aria-label={reason} />
            </span>
          );
        }

        return (
          <div key={key} className={`flex shrink-0 items-center gap-1 ${on && sections.length ? "rounded-lg bg-operation-soft/60 pr-1" : ""}`}>
            <Link href={`/projects/${projectCode}/${SYSTEM_SEGMENT[key]}`} className={`${TAB} ${on ? "bg-operation text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              <Icon className="h-4 w-4" /> {SYSTEM_LABEL[key]}
            </Link>
            {on
              ? sections.map((tab) => (
                  <Link
                    key={tab.key}
                    href={tab.href}
                    aria-current={tab.key === activeSection ? "page" : undefined}
                    className={`${TAB} ${tab.key === activeSection ? "bg-white text-operation shadow-sm ring-1 ring-operation/25" : "text-slate-600 hover:bg-white"}`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </Link>
                ))
              : null}
          </div>
        );
      })}

      <Link href={`/projects/${projectCode}/settings`} className={`${TAB} ${resolvedActive === "settings" ? "bg-operation text-white" : "text-slate-600 hover:bg-slate-100"}`}>
        <Settings className="h-4 w-4" /> ตั้งค่า
      </Link>
    </nav>
  );
}

function resolveActiveFromPathname(pathname: string | null, projectCode: string): OuterTabKey | null {
  if (!pathname) return null;
  const base = `/projects/${projectCode}/`;
  if (!pathname.startsWith(base)) return null;
  const rest = pathname.slice(base.length);
  if (rest.startsWith("ground-transfer")) return "ground_transfer";
  if (rest.startsWith("airport-transfer")) return "airport_transfer";
  if (rest.startsWith("settings")) return "settings";
  return null;
}
