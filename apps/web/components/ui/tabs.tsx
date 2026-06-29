import type { ReactNode } from "react";

export function Tabs({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2 rounded-md border border-slate-200 bg-white p-1">{children}</div>;
}

export function TabItem({ label, active = false }: { label: string; active?: boolean }) {
  return <button className={`rounded-md px-3 py-2 text-sm font-semibold ${active ? "bg-operation text-white" : "text-slate-600 hover:bg-slate-100"}`} type="button">{label}</button>;
}

