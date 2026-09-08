import Link from "next/link";
import { Bell, ChevronRight, TriangleAlert } from "lucide-react";
import { formatRelativeTh } from "@/lib/ui/relative-time";

type Tone = "info" | "warning" | "critical";

interface NotificationCardProps {
  title: string;
  body?: string;
  tone?: Tone;
  at?: string | null;
  actionHref?: string;
  actionLabel?: string;
}

const TONE: Record<Tone, { bar: string; icon: string; Icon: typeof Bell }> = {
  info: { bar: "bg-operation", icon: "text-operation", Icon: Bell },
  warning: { bar: "bg-amber-400", icon: "text-amber-600", Icon: TriangleAlert },
  critical: { bar: "bg-rose-500", icon: "text-rose-600", Icon: TriangleAlert }
};

// Every notification carries a message + a concrete next action (NOT-001/003).
export function NotificationCard({ title, body, tone = "info", at, actionHref, actionLabel }: NotificationCardProps) {
  const style = TONE[tone];
  const Icon = style.Icon;

  return (
    <article className="smart-card relative overflow-hidden pl-4">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${style.bar}`} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon className={`h-4 w-4 shrink-0 ${style.icon}`} />
          {title}
        </p>
        <span className="meta-text shrink-0">{formatRelativeTh(at)}</span>
      </div>
      {body ? <p className="mt-1 text-[13px] leading-5 text-ink-soft">{body}</p> : null}
      {actionHref ? (
        <Link
          href={actionHref}
          className="mt-2.5 inline-flex items-center gap-1 rounded-command bg-operation px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-operation-deep"
        >
          {actionLabel ?? "เปิดดู"}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </article>
  );
}
