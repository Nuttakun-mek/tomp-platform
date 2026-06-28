interface ActionCardProps {
  title: string;
  description: string;
  meta?: string;
}

export function ActionCard({ title, description, meta }: ActionCardProps) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      {meta ? <p className="text-xs font-semibold uppercase tracking-wide text-operation">{meta}</p> : null}
      <h3 className="mt-1 text-base font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </article>
  );
}
