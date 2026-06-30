export function ResourceQualityCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </article>
  );
}
