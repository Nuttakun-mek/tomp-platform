"use client";

import Link from "next/link";
import { useState } from "react";
import { getGoogleSignInUrlAction, signInWithEmailAction } from "@/app/actions/auth";

const roles = [
  { title: "Admin / Operation Manager", body: "ดูภาพรวม ศูนย์ควบคุม แผนที่ GPS และ Timeline ของทุกโครงการที่มีสิทธิ์" },
  { title: "Planner / Coordinator", body: "สร้างโครงการ ภารกิจ Assignment และ QR สำหรับคนขับ" },
  { title: "Driver", body: "เปิดจาก QR หรือ URL ที่ผูกกับ Assignment เพื่อยืนยันงานและแชร์ GPS" }
];

export function LoginPanel() {
  const [message, setMessage] = useState<string | null>(null);

  async function handleEmail(formData: FormData) {
    const result = await signInWithEmailAction({ email: formData.get("email") });
    setMessage(result.success ? "ส่งลิงก์เข้าสู่ระบบไปที่อีเมลแล้ว กรุณาตรวจสอบกล่องจดหมาย" : result.error || "เข้าสู่ระบบด้วยอีเมลไม่สำเร็จ");
  }

  async function handleGoogle() {
    const result = await getGoogleSignInUrlAction();
    if (result.success && result.data && typeof result.data === "object" && "url" in result.data && typeof result.data.url === "string") {
      window.location.href = result.data.url;
      return;
    }
    setMessage(result.error || "ยังไม่ได้ตั้งค่า Google OAuth สำหรับรอบ Pilot นี้");
  }

  return (
    <section className="grid gap-6">
      <div className="enterprise-panel overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.22em] text-operation">TOMP ACCESS</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-ink">เข้าสู่ระบบปฏิบัติการ</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              เจ้าหน้าที่ใช้บัญชีเพื่อเข้าถึงโครงการและศูนย์ควบคุม ส่วนคนขับเข้าผ่าน QR ที่ผูกกับ Assignment เท่านั้น
            </p>
            <div className="mt-5 grid gap-3">
              {roles.map((role) => (
                <div key={role.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="font-semibold text-ink">{role.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{role.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h2 className="text-xl font-semibold text-ink">เข้าสู่ระบบสำหรับเจ้าหน้าที่</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">ใช้ Supabase Auth สำหรับรอบ Pilot ก่อน harden RBAC production ในระยะถัดไป</p>
            <form action={handleEmail} className="mt-5 grid gap-3">
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                อีเมล
                <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-operation focus:ring-4 focus:ring-teal-100" name="email" placeholder="name@company.com" type="email" />
              </label>
              <button className="rounded-xl bg-operation px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-operation-deep" type="submit">
                ส่งลิงก์เข้าสู่ระบบทางอีเมล
              </button>
            </form>
            <button className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-operation hover:bg-teal-50" onClick={handleGoogle} type="button">
              เข้าสู่ระบบด้วย Google
            </button>
            {message ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-700">{message}</p> : null}
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
              Driver ไม่ต้อง login ที่หน้านี้ ให้เปิดจาก QR ที่ศูนย์ควบคุมสร้างให้
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-operation hover:bg-teal-50" href="/mission-control">
          ไปศูนย์ควบคุม
        </Link>
        <Link className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-operation hover:bg-teal-50" href="/live-test">
          ทดสอบ QR และ GPS
        </Link>
      </div>
    </section>
  );
}
