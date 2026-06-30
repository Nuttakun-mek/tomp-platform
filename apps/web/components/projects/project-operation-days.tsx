import type { OperationDay } from "@tomp/types/domain";

export function ProjectOperationDays({ operationDays }: { operationDays: OperationDay[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-operation">Operation Days</p>
      <h2 className="mt-1 text-lg font-semibold text-ink">วันปฏิบัติการ</h2>
      <div className="mt-4 grid gap-3">
        {operationDays.length ? (
          operationDays.map((day) => (
            <div key={day.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-ink">วันที่ {day.dayNumber}</p>
              <p className="text-sm text-slate-600">{day.operationDate}</p>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">ยังไม่มีวันปฏิบัติการ</p>
        )}
      </div>
    </section>
  );
}
