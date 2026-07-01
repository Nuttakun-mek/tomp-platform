import type { ReactNode } from "react";

export function CommandPanel({ title, eyebrow, children, action }: { title: string; eyebrow?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="enterprise-panel overflow-hidden">
      <div className="enterprise-surface flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          {eyebrow ? <p className="text-xs font-semibold tracking-[0.16em] text-operation">{eyebrow}</p> : null}
          <h2 className="mt-1 text-lg font-semibold text-ink">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
