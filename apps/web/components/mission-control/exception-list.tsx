import { StatusBadge } from "@/components/ui/status-badge";

const exceptions = ["คนขับยังไม่ยืนยันความพร้อม", "รถยังไม่ยืนยันความพร้อม", "ยังไม่มีรูปรถ", "ยังไม่ยินยอมเปิดตำแหน่ง GPS"];

export function ExceptionList() {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">รายการที่ต้องติดตาม</h2>
      <div className="mt-4 grid gap-3">
        {exceptions.length ? (
          exceptions.map((item) => (
            <div key={item} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
              <span className="text-sm text-slate-700">{item}</span>
              <StatusBadge label="ข้อมูลตัวอย่าง" tone="warning" />
            </div>
          ))
        ) : (
          <p className="rounded-md border border-slate-200 p-3 text-sm text-slate-600">ยังไม่มีรายการที่ต้องติดตาม</p>
        )}
      </div>
    </section>
  );
}
