interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <section className="mb-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-operation">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink">{title}</h1>
      <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{description}</p>
    </section>
  );
}
