export function StatusDot({ tone = "success", pulse = false }: { tone?: "success" | "warning" | "danger" | "info" | "neutral"; pulse?: boolean }) {
  const toneClass = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
    info: "bg-blue-500",
    neutral: "bg-slate-400"
  }[tone];

  return <span className={`inline-flex h-2.5 w-2.5 rounded-full ${toneClass} ${pulse ? "status-pulse status-pulse-live" : ""}`} />;
}
