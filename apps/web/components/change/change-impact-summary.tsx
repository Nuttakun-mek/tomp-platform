export function ChangeImpactSummary({ summary, severity = "medium" }: { summary?: string | null; severity?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">สรุปผลกระทบ</p>
      <p className="mt-1 text-sm text-slate-700">{summary || "ยังไม่มีสรุปผลกระทบ"}</p>
      <p className="mt-2 text-xs font-semibold text-operation">ระดับความรุนแรง: {severity}</p>
    </div>
  );
}
