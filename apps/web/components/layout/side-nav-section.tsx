import type { ReactNode } from "react";

export function SideNavSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-1">
      <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</p>
      {children}
    </section>
  );
}
