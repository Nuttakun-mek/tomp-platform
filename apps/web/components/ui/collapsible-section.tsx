"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  storageKey?: string;
  badge?: ReactNode;
  description?: string;
}

// Section wrapper the control centre can show/hide. Open state is remembered
// per-viewer in localStorage (best-effort — renders fine with nothing stored).
export function CollapsibleSection({ title, children, defaultOpen = true, storageKey, badge, description }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = window.localStorage.getItem(`collapsible:${storageKey}`);
      if (stored === "open") setOpen(true);
      else if (stored === "closed") setOpen(false);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    function openFromEvent(event: Event) {
      const detail = (event as CustomEvent<{ storageKey?: string }>).detail;
      if (detail?.storageKey !== storageKey) return;
      setOpen(true);
      try {
        window.localStorage.setItem(`collapsible:${storageKey}`, "open");
      } catch {
        /* ignore */
      }
    }

    window.addEventListener("tomp:open-collapsible", openFromEvent);
    return () => window.removeEventListener("tomp:open-collapsible", openFromEvent);
  }, [storageKey]);

  function toggle() {
    setOpen((current) => {
      const next = !current;
      if (storageKey) {
        try {
          window.localStorage.setItem(`collapsible:${storageKey}`, next ? "open" : "closed");
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }

  return (
    <section className="enterprise-panel overflow-visible">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-ink">{title}</span>
            {badge}
          </span>
          {description ? <span className="mt-0.5 block text-xs text-slate-500">{description}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-500">
          {open ? "ซ่อน" : "แสดง"}
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open ? <div className="border-t border-slate-200 p-3.5">{children}</div> : null}
    </section>
  );
}
