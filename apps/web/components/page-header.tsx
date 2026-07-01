interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <section className="enterprise-panel overflow-hidden">
      <div className="enterprise-surface p-5 lg:p-7">
        <p className="text-xs font-semibold tracking-[0.18em] text-operation">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight text-ink md:text-4xl">{title}</h1>
        <p className="mt-3 max-w-4xl text-base leading-8 text-slate-600">{description}</p>
      </div>
    </section>
  );
}
