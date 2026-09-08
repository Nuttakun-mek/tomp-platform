"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CarFront,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  Gauge,
  MapPinned,
  Menu,
  PanelsTopLeft,
  ShieldAlert,
  UserRoundCheck,
  Users,
  X,
  type LucideIcon
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import type { NavSection } from "@/lib/auth/nav-model";

const ICONS: Record<string, LucideIcon> = {
  Gauge,
  MapPinned,
  ClipboardList,
  FolderKanban,
  CarFront,
  UserRoundCheck,
  PanelsTopLeft,
  Users,
  ShieldAlert
};

export function AppNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="grid gap-3">
      <button
        className="flex min-h-11 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm lg:hidden"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>เมนูระบบ</span>
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      <nav className={`${open ? "grid" : "hidden"} gap-5 lg:grid`} aria-label="เมนูหลัก">
        {sections.map((section) => (
          <section key={section.title} className="grid gap-2">
            <p className="px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 lg:text-slate-400">{section.title}</p>
            <div className="grid gap-1.5">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon] ?? Gauge;
                const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Tooltip key={item.href} content={item.help} side="right" className="w-full">
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`group flex w-full items-center gap-3 rounded-[18px] border px-3 py-3 transition duration-200 ${
                        active
                          ? "border-teal-300/60 bg-white text-ink shadow-[0_16px_34px_rgba(15,118,110,0.18)] lg:bg-white/95"
                          : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50 lg:bg-transparent lg:text-slate-300 lg:hover:border-white/10 lg:hover:bg-white/8 lg:hover:text-white"
                      }`}
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-[14px] ${
                          active ? "bg-operation text-white" : "bg-slate-100 text-slate-500 group-hover:text-operation lg:bg-white/8 lg:text-slate-400 lg:group-hover:text-white"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold leading-5">{item.label}</span>
                        <span className={`mt-0.5 block truncate text-[12px] leading-5 ${active ? "text-slate-600" : "text-slate-500 lg:group-hover:text-slate-300"}`}>
                          {item.description}
                        </span>
                      </span>
                      <ChevronRight className={`h-4 w-4 shrink-0 ${active ? "text-operation" : "text-slate-300 opacity-0 transition group-hover:opacity-100"}`} />
                    </Link>
                  </Tooltip>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </div>
  );
}
