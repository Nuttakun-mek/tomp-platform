import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="grid justify-items-center gap-3 rounded-panel border border-dashed border-border bg-canvas/50 px-6 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-panel bg-white text-ink-faint shadow-sm">
        {icon ?? <Inbox className="h-5 w-5" />}
      </span>
      <div className="min-w-0">
        <p className="card-title">{title}</p>
        {description ? <p className="section-description mx-auto mt-1 max-w-sm">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
