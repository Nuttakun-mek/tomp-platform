"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="enterprise-panel max-w-xl p-6 text-center">
        <p className="text-sm font-semibold text-red-700">ระบบพบข้อผิดพลาด</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">หน้านี้โหลดไม่สำเร็จ</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          กรุณาลองโหลดใหม่ หากยังพบปัญหาให้ตรวจสถานะระบบ Pilot หรือแจ้งผู้ดูแลระบบพร้อมรหัสอ้างอิงนี้
        </p>
        {error.digest ? <p className="mt-3 rounded-2xl bg-slate-100 p-3 text-xs font-semibold text-slate-600">รหัสอ้างอิง: {error.digest}</p> : null}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button className="rounded-2xl bg-operation px-5 py-3 text-sm font-semibold text-white shadow-sm" type="button" onClick={reset}>
            ลองโหลดใหม่
          </button>
          <Link className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm" href="/admin/pilot-smoke-test">
            ตรวจระบบ Pilot
          </Link>
        </div>
      </section>
    </main>
  );
}
