"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A numbered step that folds away.
 *
 * Both steps are long forms, and once a project is set up neither is needed
 * again for the rest of the day — leaving them open pushed the unit cards, which
 * is what an operator actually watches, below the fold. The header stays as the
 * summary, so a folded step still says what it is and whether it can be used.
 */
export function SetupStep({
  step,
  title,
  description,
  children,
  defaultOpen = true,
  disabledNote
}: {
  step: string;
  title: string;
  description: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Shown instead of the body when the step cannot be used yet. */
  disabledNote?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="enterprise-panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
      >
        <span className="min-w-0">
          <span className="section-label block">{step}</span>
          <span className="block text-lg font-semibold text-ink">{title}</span>
          <span className="mt-1 block text-sm leading-6 text-slate-600">{description}</span>
        </span>
        <span className="mt-1 flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-ink-faint">
          {open ? "ย่อ" : "ขยาย"}
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open ? (
        <div className="border-t border-slate-100 p-4">
          {disabledNote ? (
            <p className="rounded-card bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-800">{disabledNote}</p>
          ) : (
            children
          )}
        </div>
      ) : null}
    </section>
  );
}
