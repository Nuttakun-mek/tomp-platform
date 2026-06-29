export function ChangeRequestList() {
  const examples = [
    { id: "CR-demo-1", status: "requested", summary: "Move pickup wave by 15 minutes after baseline." },
    { id: "CR-demo-2", status: "approved", summary: "Replace standby vehicle for call sign A-01." }
  ];

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Change Requests</h2>
      <div className="mt-4 grid gap-3">
        {examples.map((item) => (
          <article key={item.id} className="rounded-md border border-slate-200 p-3">
            <p className="text-sm font-semibold text-ink">{item.id}</p>
            <p className="text-sm text-slate-600">{item.summary}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-operation">{item.status}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

