export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

