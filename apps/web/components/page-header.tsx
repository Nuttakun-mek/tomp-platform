interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <section className="enterprise-panel overflow-hidden">
      <div className="enterprise-surface p-5 lg:p-6">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-operation">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold leading-snug text-ink md:text-3xl">{title}</h1>
        <p className="mt-3 max-w-4xl text-[15px] leading-7 text-slate-600">{description}</p>
      </div>
    </section>
  );
}
