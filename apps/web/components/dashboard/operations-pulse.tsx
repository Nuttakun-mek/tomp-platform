import { ProgressBar } from "@/components/ui/progress-bar";

export function OperationsPulse({ ready, followUp, risk, active, completed }: { ready: number; followUp: number; risk: number; active: number; completed: number }) {
  const total = Math.max(1, ready + followUp + risk + active + completed);
  const items = [
    { label: "พร้อม", value: ready, tone: "operation" as const },
    { label: "ต้องติดตาม", value: followUp, tone: "warning" as const },
    { label: "เสี่ยง", value: risk, tone: "danger" as const },
    { label: "กำลังปฏิบัติการ", value: active, tone: "route" as const },
    { label: "เสร็จสิ้น", value: completed, tone: "operation" as const }
  ];

  return (
    <section className="enterprise-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-operation">OPERATIONS PULSE</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">สัญญาณปฏิบัติการวันนี้</h2>
        </div>
        <p className="text-sm text-slate-500">อัปเดตจากงานและสัญญาณ GPS ล่าสุด</p>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-5">
        {items.map((item) => (
          <article key={item.label} className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm font-semibold text-slate-600">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{item.value}</p>
            <div className="mt-3">
              <ProgressBar value={(item.value / total) * 100} tone={item.tone} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
