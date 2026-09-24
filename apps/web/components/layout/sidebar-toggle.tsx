"use client";

import { useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SIDEBAR_COOKIE } from "@/lib/workspace/sidebar";

// Collapses the desktop sidebar to an icon rail. The shell reads the cookie on
// the server so the page never renders wide and then snaps narrow; the toggle
// flips the attribute in place so there is no round trip.
export function SidebarToggle({ initialCollapsed }: { initialCollapsed: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    const shell = ref.current?.closest<HTMLElement>("[data-sidebar]");
    if (shell) shell.dataset.sidebar = next ? "collapsed" : "expanded";
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  const label = collapsed ? "ขยายแถบเมนู" : "ย่อแถบเมนู";
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <button
      ref={ref}
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-white lg:group-data-[sidebar=collapsed]/shell:justify-center lg:group-data-[sidebar=collapsed]/shell:px-0"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="lg:group-data-[sidebar=collapsed]/shell:hidden">{label}</span>
    </button>
  );
}
