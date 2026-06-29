export function ChangeImpactSummary({ summary, severity = "medium" }: { summary?: string | null; severity?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Impact summary</p>
      <p className="mt-1 text-sm text-slate-700">{summary || "No impact summary has been provided yet."}</p>
      <p className="mt-2 text-xs font-semibold text-operation">Severity: {severity}</p>
    </div>
  );
}

