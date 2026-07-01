import Link from "next/link";

const actions = [
  { href: "/projects/new", label: "สร้างโครงการ", detail: "เริ่มพื้นที่ปฏิบัติการใหม่" },
  { href: "/mission-control", label: "เปิดศูนย์ควบคุม", detail: "ดูแผนที่ สถานะ และความเสี่ยง" },
  { href: "/live-test", label: "ทดสอบหน้าคนขับ", detail: "สร้าง QR และทดสอบ GPS" },
  { href: "/pilot-checklist", label: "ทดสอบ Pilot", detail: "เดิน flow แบบมีขั้นตอน" }
];

export function QuickActionPanel() {
  return (
    <section className="enterprise-panel p-5">
      <p className="text-xs font-semibold tracking-[0.16em] text-operation">QUICK ACTIONS</p>
      <h2 className="mt-1 text-xl font-semibold text-ink">ทางลัดปฏิบัติการ</h2>
      <div className="mt-4 grid gap-3">
        {actions.map((action) => (
          <Link key={action.href} className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4 transition hover:border-operation/40 hover:bg-teal-50" href={action.href}>
            <p className="font-semibold text-ink">{action.label}</p>
            <p className="mt-1 text-sm text-slate-600">{action.detail}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
