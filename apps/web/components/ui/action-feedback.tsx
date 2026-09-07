import { CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";

type FeedbackTone = "info" | "success" | "warning" | "danger";

const toneClass: Record<FeedbackTone, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  danger: "border-red-200 bg-red-50 text-red-900"
};

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: XCircle
};

export function ActionFeedback({ message, tone = "info" }: { message?: string | null; tone?: FeedbackTone }) {
  if (!message) return null;
  const Icon = icons[tone];
  return (
    <div className={`flex items-start gap-2 rounded-2xl border px-3 py-3 text-sm font-medium leading-6 ${toneClass[tone]}`} role={tone === "danger" ? "alert" : "status"}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
