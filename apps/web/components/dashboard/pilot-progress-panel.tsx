const stages = ["วางแผน", "เตรียมพร้อม", "ประกาศใช้แผน", "ปฏิบัติการ", "กู้คืนสถานการณ์", "ทบทวนผล"];

export function PilotProgressPanel() {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-operation">TOMP Operating Model</p>
      <h2 className="mt-1 text-lg font-semibold text-ink">วงจรการดำเนินงาน</h2>
      <div className="mt-5 grid gap-3">
        {stages.map((stage, index) => (
          <div key={stage} className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-operation text-sm font-semibold text-white">{index + 1}</span>
            <p className="font-semibold text-ink">{stage}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
