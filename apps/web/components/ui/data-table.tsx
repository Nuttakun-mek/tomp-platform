import type { ReactNode } from "react";

export function DataTable({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-soft"><table className="w-full text-left text-sm">{children}</table></div>;
}
