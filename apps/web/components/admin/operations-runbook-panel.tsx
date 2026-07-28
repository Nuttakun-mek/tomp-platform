const runbookItems = [
  {
    title: "ตรวจสุขภาพระบบ",
    detail: "เปิด /api/health และตรวจว่า status เป็น ok ก่อนเริ่มทดสอบหรือก่อนรับงานจริง",
    href: "/api/health"
  },
  {
    title: "ตรวจข้อมูล Pilot",
    detail: "ใช้ Data Quality เพื่อตรวจชื่อเพี้ยน, Assignment ไม่ครบ, QR และ GPS ก่อนส่งให้ทีมทดสอบ",
    href: "/admin/data-quality"
  },
  {
    title: "สร้างชุดทดสอบ GPS",
    detail: "ใช้ Live Test เพื่อสร้าง Assignment + QR + Driver link สำหรับทดสอบตำแหน่งจริง",
    href: "/live-test"
  },
  {
    title: "ติดตามศูนย์ควบคุม",
    detail: "Mission Control ต้องเห็นงาน, GPS freshness, Timeline และรายการที่ต้องติดตาม",
    href: "/mission-control"
  },
  {
    title: "เปิดเหตุผิดปกติ",
    detail: "หาก GPS หาย รถมีปัญหา หรือคนขับไม่ตอบ ให้เปิดเหตุที่ Recovery เพื่อสร้าง Timeline",
    href: "/recovery"
  }
];

export function OperationsRunbookPanel() {
  return (
    <div className="grid gap-6">
      <section className="enterprise-card p-5 lg:p-6">
        <p className="text-sm font-semibold text-operation">Production Operations</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">Runbook ใช้งานและดูแลระบบ</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          หน้านี้รวมขั้นตอนที่เจ้าหน้าที่ควรตรวจทุกครั้งก่อนทดสอบหรือใช้งาน internal pilot จริง
        </p>
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        {runbookItems.map((item) => (
          <a key={item.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-panel" href={item.href}>
            <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
          </a>
        ))}
      </section>
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
        <p className="font-semibold">ข้อควรจำ</p>
        <p className="mt-2 text-sm leading-6">
          Web GPS ใช้สำหรับทดสอบและปฏิบัติการแบบเปิดหน้า browser ค้างไว้ หากต้องการติดตามตอนปิดจอหรือสลับแอป ต้องใช้ Mobile Driver App ในระยะถัดไป
        </p>
      </section>
    </div>
  );
}
