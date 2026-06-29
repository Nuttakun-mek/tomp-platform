export function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
      {detail ? <p className="mt-2 text-sm text-slate-600">{detail}</p> : null}
    </article>
  );
}

