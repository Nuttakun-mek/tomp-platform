export function RiskBadge({ level }: { level: "low" | "medium" | "high" | "critical" }) {
  const config = {
    low: "border-emerald-200 bg-emerald-50 text-emerald-800",
    medium: "border-amber-200 bg-amber-50 text-amber-800",
    high: "border-orange-200 bg-orange-50 text-orange-800",
    critical: "border-rose-200 bg-rose-50 text-rose-800"
  }[level];
  const label = { low: "ปกติ", medium: "ต้องติดตาม", high: "เสี่ยง", critical: "วิกฤต" }[level];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${config}`}>{label}</span>;
}
