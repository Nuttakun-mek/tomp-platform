import { ProgressBar } from "@/components/ui/progress-bar";

export function OperationsPulse({ ready, followUp, risk, active, completed }: { ready: number; followUp: number; risk: number; active: number; completed: number }) {
  const total = Math.max(1, ready + followUp + risk + active + completed);
  const items = [
    { label: "พร้อม", value: ready, tone: "operation" as const, detail: "ข้อมูลครบและพร้อมดำเนินงาน" },
    { label: "ต้องติดตาม", value: followUp, tone: "warning" as const, detail: "ยังขาดคนขับ รถ หรือ Call Sign" },
    { label: "เสี่ยง", value: risk, tone: "danger" as const, detail: "GPS ขาดช่วงหรือมีสัญญาณผิดปกติ" },
    { label: "กำลังปฏิบัติการ", value: active, tone: "route" as const, detail: "งานที่กำลังเคลื่อนอยู่" },
    { label: "เสร็จสิ้น", value: completed, tone: "operation" as const, detail: "งานที่ปิดรอบแล้ว" }
  ];

  return (
    <section className="enterprise-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="page-kicker">สัญญาณปฏิบัติการ</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">สิ่งที่ต้องรู้ตอนนี้</h2>
        </div>
        <p className="text-sm text-slate-500">อัปเดตจากงานที่จัดสรรและสัญญาณ GPS ล่าสุด</p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        {items.map((item) => (
          <article key={item.label} className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm font-semibold text-slate-700">{item.label}</p>
            <p className="mt-2 text-[32px] font-semibold leading-none text-ink">{item.value}</p>
            <p className="mt-2 min-h-10 text-[12px] leading-5 text-slate-500">{item.detail}</p>
            <div className="mt-3">
              <ProgressBar value={(item.value / total) * 100} tone={item.tone} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
