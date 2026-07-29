import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="enterprise-panel max-w-xl p-6 text-center">
        <p className="text-sm font-semibold text-operation">ไม่พบหน้าที่ต้องการ</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">ลิงก์นี้ไม่พร้อมใช้งาน</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          หน้านี้อาจถูกย้าย ลิงก์ QR อาจหมดอายุ หรือ deployment ยังไม่ใช่เวอร์ชันล่าสุด กรุณากลับไปที่ภาพรวมระบบแล้วเลือกเมนูที่ต้องการอีกครั้ง
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link className="rounded-2xl bg-operation px-5 py-3 text-sm font-semibold text-white shadow-sm" href="/">
            กลับภาพรวม
          </Link>
          <Link className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm" href="/admin/pilot-smoke-test">
            ตรวจระบบ Pilot
          </Link>
        </div>
      </section>
    </main>
  );
}
