import Link from "next/link";

const actions = [
  { href: "/mission-control", label: "เปิดศูนย์ควบคุม", detail: "ดูแผนที่ สถานะ GPS และความเสี่ยง" },
  { href: "/projects/new", label: "สร้างโครงการ", detail: "เริ่มพื้นที่ปฏิบัติการใหม่" },
  { href: "/assignments", label: "จัดสรร Assignment", detail: "เลือก Call Sign คนขับ และรถให้ครบ" },
  { href: "/live-test", label: "ทดสอบ QR และ GPS", detail: "เส้นทางทดสอบระบบแบบจบขั้นตอน" }
];

export function QuickActionPanel() {
  return (
    <section className="enterprise-panel p-5">
      <p className="text-[11px] font-bold tracking-[0.18em] text-operation">QUICK ACTIONS</p>
      <h2 className="mt-1 text-lg font-semibold text-ink">ทางลัดปฏิบัติการ</h2>
      <div className="mt-4 grid gap-3">
        {actions.map((action) => (
          <Link key={action.href} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition hover:border-operation/40 hover:bg-teal-50" href={action.href}>
            <p className="font-semibold text-ink">{action.label}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{action.detail}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
