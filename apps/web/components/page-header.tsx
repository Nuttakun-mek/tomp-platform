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
      <div className="enterprise-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between lg:p-6">
        <div className="min-w-0">
          <p className="section-label">{eyebrow}</p>
          <h1 className="page-title mt-2">{title}</h1>
          <p className="page-description mt-2.5">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}
