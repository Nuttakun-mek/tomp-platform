export function ProgressBar({ value, tone = "operation" }: { value: number; tone?: "operation" | "warning" | "danger" | "route" }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  const color = {
    operation: "bg-operation",
    warning: "bg-amber-500",
    danger: "bg-rose-600",
    route: "bg-route"
  }[tone];

  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${safeValue}%` }} />
    </div>
  );
}
