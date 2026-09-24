import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

// A heading, not a card: every page used to open with a bordered, shadowed panel
// ~110px tall before any content. Same three pieces of text, no chrome around them.
export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="section-label">{eyebrow}</p>
        <h1 className="mt-0.5 text-xl font-semibold leading-snug text-ink lg:text-[1.375rem]">{title}</h1>
        {description ? <p className="mt-0.5 max-w-3xl text-[13px] leading-6 text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
