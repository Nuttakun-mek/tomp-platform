import type { Driver } from "@tomp/types/domain";

export function DriverReadinessTable({ drivers }: { drivers: Driver[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <h2 className="text-lg font-semibold text-ink">ความพร้อมคนขับ</h2>
      <div className="mt-4 grid gap-2">
        {drivers.map((driver) => (
          <div key={driver.id} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_160px_120px]">
            <p className="font-semibold text-ink">{driver.fullName || "ยังไม่ระบุชื่อ"}</p>
            <p className="text-sm text-slate-600">{driver.phone || "ยังไม่ระบุเบอร์"}</p>
            <p className="text-sm font-semibold text-operation">{driver.phone ? "พร้อมใช้งาน" : "ขาดข้อมูล"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
