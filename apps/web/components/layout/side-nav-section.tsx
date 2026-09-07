import type { ReactNode } from "react";

export function SideNavSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <p className="px-2 text-[11px] font-bold tracking-[0.12em] text-slate-400">{title}</p>
      {children}
    </section>
  );
}
