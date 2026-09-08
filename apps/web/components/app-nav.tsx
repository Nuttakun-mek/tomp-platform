"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CarFront,
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

      <nav className={`${open ? "grid" : "hidden"} gap-4 lg:grid`} aria-label="เมนูหลัก">
        {sections.map((section) => (
          <section key={section.title} className="grid gap-1">
            <p className="px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 lg:text-slate-500">{section.title}</p>
            <div className="grid gap-0.5">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon] ?? Gauge;
                const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    title={item.help}
                    className={`group flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors ${
                      active
                        ? "border-teal-300/50 bg-white text-ink lg:bg-white/[0.12] lg:text-white"
                        : "border-transparent text-slate-700 hover:bg-slate-50 lg:text-slate-300 lg:hover:bg-white/[0.06] lg:hover:text-white"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                        active
                          ? "bg-operation text-white"
                          : "bg-slate-100 text-slate-500 group-hover:text-operation lg:bg-white/[0.06] lg:text-slate-400 lg:group-hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold leading-5">{item.label}</span>
                      {active ? (
                        <span className="block truncate text-[11px] leading-4 text-slate-500 lg:text-slate-300">{item.description}</span>
                      ) : null}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </div>
  );
}
