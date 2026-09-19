"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CarFront, PlaneTakeoff, Settings } from "lucide-react";

type SystemKey = "ground_transfer" | "airport_transfer";
type OuterTabKey = SystemKey | "settings";

const SYSTEM_LABEL: Record<SystemKey, string> = { ground_transfer: "Ground Transfer", airport_transfer: "Airport Transfer" };
const SYSTEM_ICON: Record<SystemKey, typeof CarFront> = { ground_transfer: CarFront, airport_transfer: PlaneTakeoff };
const SYSTEM_SEGMENT: Record<SystemKey, string> = { ground_transfer: "ground-transfer", airport_transfer: "airport-transfer" };

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

  // The wrapping layout can't cleanly read its own child segment in the App
  // Router, so it always passes active="ground_transfer". usePathname() (the
  // same trick apps/web/components/projects/project-workspace-tabs.tsx already
  // uses) resolves it accurately here instead, with the passed-in value as a
  // fallback for the segments it doesn't recognize.
  const pathname = usePathname();
  const resolvedActive: OuterTabKey = resolveActiveFromPathname(pathname, projectCode) ?? active;

  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-border bg-white p-1">
      {systems.map((key) => {
        const Icon = SYSTEM_ICON[key];
        const enabled = enabledSystems.includes(key);
        const accessible = viewerSystems.includes(key);
        const on = resolvedActive === key;

        if (!enabled) {
          return (
            <span key={key} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-400">
              <Icon className="h-4 w-4" /> {SYSTEM_LABEL[key]} <span className="text-xs">(ยังไม่เปิดใช้ในโครงการนี้)</span>
            </span>
          );
        }
        if (!accessible) {
          return (
            <span key={key} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-400">
              <Icon className="h-4 w-4" /> {SYSTEM_LABEL[key]} <span className="text-xs">(ใช้อยู่ในโครงการนี้)</span>
            </span>
          );
        }
        return (
          <Link key={key} href={`/projects/${projectCode}/${SYSTEM_SEGMENT[key]}`} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${on ? "bg-operation text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            <Icon className="h-4 w-4" /> {SYSTEM_LABEL[key]}
          </Link>
        );
      })}
      <Link href={`/projects/${projectCode}/settings`} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${resolvedActive === "settings" ? "bg-operation text-white" : "text-slate-600 hover:bg-slate-100"}`}>
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
