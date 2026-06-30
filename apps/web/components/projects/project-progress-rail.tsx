const stages = ["วางแผน", "เตรียมพร้อม", "ประกาศใช้แผน", "ปฏิบัติการ", "ทบทวนผล"];

export function ProjectProgressRail({ activeIndex = 1 }: { activeIndex?: number }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
      <div className="grid gap-3 md:grid-cols-5">
        {stages.map((stage, index) => (
          <div key={stage} className={`rounded-md border p-3 ${index <= activeIndex ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-slate-50"}`}>
            <p className="text-xs font-semibold text-slate-500">ขั้นตอน {index + 1}</p>
            <p className="mt-1 font-semibold text-ink">{stage}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
