import type { Assignment } from "@tomp/types/domain";
import { StatusBadge } from "@/components/ui/status-badge";

export function ExceptionList({ assignments }: { assignments: Assignment[] }) {
  const exceptions = assignments.flatMap((assignment) => {
    const items: Array<{ title: string; detail: string }> = [];
    if (!assignment.callSignId) items.push({ title: "ยังไม่มี Call Sign", detail: `Assignment ${assignment.id} ยังไม่มี Call Sign` });
    if (!assignment.driverId) items.push({ title: "ยังไม่มีคนขับ", detail: `Assignment ${assignment.id} ยังไม่ได้ผูกคนขับ` });
    if (!assignment.vehicleId) items.push({ title: "ยังไม่มีรถ", detail: `Assignment ${assignment.id} ยังไม่ได้ผูกรถ` });
    return items;
  });

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">รายการที่ต้องติดตาม</h2>
          <p className="mt-1 text-sm text-slate-600">คำนวณจาก Assignment จริงในโครงการที่เลือก</p>
        </div>
        <StatusBadge label={exceptions.length ? "ต้องติดตาม" : "พร้อม"} tone={exceptions.length ? "warning" : "ready"} />
      </div>
      <div className="mt-4 grid gap-3">
        {exceptions.length ? (
          exceptions.map((item) => (
            <article key={`${item.title}-${item.detail}`} className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
            </article>
          ))
        ) : (
          <p className="rounded-md border border-slate-200 p-3 text-sm text-slate-600">ยังไม่มีรายการที่ต้องติดตาม</p>
        )}
      </div>
    </section>
  );
}
