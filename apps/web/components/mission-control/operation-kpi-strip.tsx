export function OperationKpiStrip({ readiness, assignments, liveDrivers, followUps, timeline }: { readiness: number; assignments: number; liveDrivers: number; followUps: number; timeline: number }) {
  const items = [
    { label: "ความพร้อมรวม", value: `${readiness}%`, tone: "text-emerald-700" },
    { label: "Assignment ทั้งหมด", value: assignments, tone: "text-slate-900" },
    { label: "GPS ล่าสุด", value: liveDrivers, tone: "text-blue-700" },
    { label: "ต้องติดตาม", value: followUps, tone: followUps ? "text-amber-700" : "text-emerald-700" },
    { label: "Timeline", value: timeline, tone: "text-violet-700" }
  ];

  return (
    <section className="grid gap-3 md:grid-cols-5">
      {items.map((item) => (
        <article key={item.label} className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
          <p className="text-xs font-semibold text-slate-500">{item.label}</p>
          <p className={`mt-2 text-2xl font-semibold ${item.tone}`}>{item.value}</p>
        </article>
      ))}
    </section>
  );
}
