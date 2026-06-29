import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={`rounded-md border border-slate-200 bg-white p-5 shadow-sm ${className}`} {...props} />;
}

export function CardHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`mb-4 flex items-start justify-between gap-4 ${className}`} {...props} />;
}

