interface StatusBadgeProps {
  label: string;
  tone?: "neutral" | "ready" | "warning" | "critical";
}

const toneClasses = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  ready: "border-teal-200 bg-teal-50 text-teal-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  critical: "border-red-200 bg-red-50 text-red-800"
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}>{label}</span>;
}
