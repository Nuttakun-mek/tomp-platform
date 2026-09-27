"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";

/**
 * A button that opens its content in a panel from the right. For the forms a
 * page needs now and then — they no longer push the page's real content down.
 * The panel is wide (up to 72rem) so forms keep the layout they were built for.
 */
export function SideDrawer({
  label,
  title,
  children,
  defaultOpen = false
}: {
  label: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-command bg-operation px-3.5 text-[13px] font-semibold text-white shadow-sm"
      >
        <Plus className="h-4 w-4" /> {label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(event) => event.stopPropagation()}
            className="flex h-full w-full max-w-[72rem] flex-col bg-canvas shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border bg-white px-4 py-3">
              <h2 className="text-base font-semibold text-ink">{title}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="ปิด" className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid content-start gap-4 overflow-y-auto p-4">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
