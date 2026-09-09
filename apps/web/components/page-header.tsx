import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <section className="enterprise-panel overflow-hidden">
      <div className="enterprise-surface flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between lg:p-4">
        <div className="min-w-0">
          <p className="section-label">{eyebrow}</p>
          <h1 className="page-title mt-1">{title}</h1>
          <p className="page-description mt-1">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}
