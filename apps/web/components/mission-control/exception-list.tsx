import { StatusBadge } from "@/components/ui/status-badge";

const exceptions = [
  { title: "คนขับยังไม่ยืนยันความพร้อม", detail: "ต้องให้คนขับเปิด QR และส่งข้อมูลความพร้อม" },
  { title: "รถยังไม่มีรูปรถ", detail: "ต้องถ่ายรูปรถก่อนเริ่มงาน" },
  { title: "ยังไม่มีรูปป้ายทะเบียน", detail: "ต้องใช้เป็นหลักฐานก่อนปล่อยรถ" },
  { title: "ยังไม่ยินยอมเปิดตำแหน่ง GPS", detail: "ต้องยืนยันก่อนเริ่มปฏิบัติงาน" }
];

export function ExceptionList() {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">รายการที่ต้องติดตาม</h2>
          <p className="mt-1 text-sm text-slate-600">ข้อมูลตัวอย่างสำหรับตรวจความพร้อมก่อนเริ่มงาน</p>
        </div>
        <StatusBadge label="ต้องติดตาม" tone="warning" />
      </div>
      <div className="mt-4 grid gap-3">
        {exceptions.length ? (
          exceptions.map((item) => (
            <article key={item.title} className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden="true" />
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-md border border-slate-200 p-3 text-sm text-slate-600">ยังไม่มีรายการที่ต้องติดตาม</p>
        )}
      </div>
    </section>
  );
}
