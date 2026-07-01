export function DriverNotificationConsole() {
  const rows = [
    { title: "งานใหม่", status: "รอรับทราบ", priority: "สำคัญ" },
    { title: "เปลี่ยนเวลา", status: "ส่งแล้ว", priority: "ปกติ" }
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-sm font-semibold text-operation">แจ้งเตือนคนขับ</p>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <div key={row.title} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-ink">{row.title}</p>
              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{row.priority}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{row.status}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
