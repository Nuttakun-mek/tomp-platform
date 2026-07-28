const readinessItems = [
  { area: "Auth/RBAC", status: "ต้อง harden ต่อ", detail: "มี Supabase Auth และ server action permission checks แล้ว แต่ต้องทดสอบ RLS กับผู้ใช้จริง" },
  { area: "GPS", status: "พร้อมทดสอบ Pilot", detail: "Web GPS ส่งตำแหน่งเข้า Mission Control ได้ แต่ background ตอนปิดจอต้องใช้ Mobile App" },
  { area: "Data Governance", status: "เริ่มควบคุมได้", detail: "มี Data Quality และ archive ชุดทดสอบแบบไม่ลบข้อมูล" },
  { area: "Publish/Change", status: "มี foundation", detail: "มี publish snapshot และ change request แต่ต้องเพิ่ม transaction guarantee" },
  { area: "Realtime", status: "พร้อมทดสอบ Pilot", detail: "มี realtime subscription + polling fallback และสถานะ live/fallback/offline" },
  { area: "Driver Workflow", status: "พร้อมทดสอบ Pilot", detail: "QR, driver card, GPS share, status update และ issue report ใช้งานได้ใน web" },
  { area: "QR Security", status: "มี foundation", detail: "token hash/expiry/revoke มีแล้ว ต้องเพิ่ม rate limit และ abuse detection" },
  { area: "Supabase Security", status: "ต้อง audit", detail: "ต้องรัน Supabase advisor, RLS test harness และตรวจ grants บน production" },
  { area: "Testing", status: "unit ผ่าน", detail: "มี unit tests 30 รายการหลัง batch นี้ แต่ยังต้องเพิ่ม browser E2E จริง" },
  { area: "UX/UI", status: "พร้อม internal pilot", detail: "Thai-first และ command UI ดีขึ้น แต่ยังควรทำ visual QA กับผู้ใช้จริง" },
  { area: "Recovery", status: "เริ่มใช้งานได้", detail: "เปิด incident และ recommendation ได้ พร้อม Timeline event" },
  { area: "Operations", status: "ต้องเสริม monitoring", detail: "Deploy ได้แล้ว แต่ยังต้องเพิ่ม logging, alerting, backup/restore checklist" }
];

function statusClass(status: string) {
  if (status.includes("พร้อม")) return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status.includes("ต้อง")) return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-blue-200 bg-blue-50 text-blue-900";
}

export function EnterpriseReadinessPanel() {
  return (
    <div className="grid gap-6">
      <section className="enterprise-card p-5 lg:p-6">
        <p className="text-sm font-semibold text-operation">Enterprise Readiness</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">ภาพรวม 12 แกนก่อนใช้งานจริง</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          หน้านี้แยกสิ่งที่ทดสอบได้แล้วออกจากสิ่งที่ยังต้อง harden เพื่อไม่ให้เข้าใจผิดว่าเป็น production 100% ทั้งหมด
        </p>
      </section>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {readinessItems.map((item) => (
          <article key={item.area} className={`rounded-2xl border p-4 ${statusClass(item.status)}`}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">{item.area}</h3>
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold">{item.status}</span>
            </div>
            <p className="mt-2 text-sm leading-6">{item.detail}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
