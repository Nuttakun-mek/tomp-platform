import type { ReactNode } from "react";

export function CommandPanel({ title, eyebrow, children, action }: { title: string; eyebrow?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white panel-glow">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4">
        <div>
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-operation">{eyebrow}</p> : null}
          <h2 className="mt-1 text-lg font-semibold text-ink">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
