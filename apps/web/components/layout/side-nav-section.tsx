import type { ReactNode } from "react";

export function SideNavSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-1.5">
      <p className="px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      {children}
    </section>
  );
}
