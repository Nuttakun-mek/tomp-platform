import type { SelectHTMLAttributes } from "react";

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-operation focus:ring-2 focus:ring-teal-100 ${className}`} {...props} />;
}

