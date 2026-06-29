import { ChangeStatusBadge } from "@/components/change/change-status-badge";

export function ChangeRequestList() {
  const examples = [
    { id: "CR-demo-1", status: "requested", summary: "เลื่อนรอบรับผู้โดยสารออกไป 15 นาทีหลังประกาศใช้แผน" },
    { id: "CR-demo-2", status: "approved", summary: "เปลี่ยนรถสำรองสำหรับ Call Sign A-01" }
  ];

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">คำขอเปลี่ยนแปลง</h2>
      <div className="mt-4 grid gap-3">
        {examples.map((item) => (
          <article key={item.id} className="rounded-md border border-slate-200 p-3">
            <p className="text-sm font-semibold text-ink">{item.id}</p>
            <p className="text-sm text-slate-600">{item.summary}</p>
            <div className="mt-2"><ChangeStatusBadge status={item.status} /></div>
          </article>
        ))}
      </div>
    </section>
  );
}
