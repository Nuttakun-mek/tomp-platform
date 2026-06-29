const tones = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  success: "border-teal-200 bg-teal-50 text-teal-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
  info: "border-blue-200 bg-blue-50 text-blue-800"
};

export function Badge({ label, tone = "neutral" }: { label: string; tone?: keyof typeof tones }) {
  return <span className={`inline-flex whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{label}</span>;
}
