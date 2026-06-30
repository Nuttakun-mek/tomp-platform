"use client";

import Link from "next/link";
import { useState } from "react";
import { getGoogleSignInUrlAction, signInWithEmailAction } from "@/app/actions/auth";

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
      <div className="rounded-md border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold text-operation">ทางเข้าใช้งาน TOMP</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">เลือกบทบาทก่อนเริ่มทดสอบ</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          รอบนี้เป็น Internal Pilot: เจ้าหน้าที่สามารถเข้าหน้าปฏิบัติการเพื่อทดสอบข้อมูลจริงได้ ส่วนคนขับต้องเปิดจากลิงก์ QR ที่สร้างจาก Assignment เท่านั้น
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Link className="rounded-md border border-blue-200 bg-blue-50 p-5 shadow-sm hover:border-blue-500" href="/mission-control">
          <p className="text-sm font-semibold text-blue-800">เจ้าหน้าที่ / Admin</p>
          <h2 className="mt-2 text-xl font-semibold text-blue-950">เข้าศูนย์ควบคุม</h2>
          <p className="mt-2 text-sm leading-6 text-blue-900">ดู Dashboard, แผนที่ GPS, Timeline และสถานะคนขับจากข้อมูลจริง</p>
        </Link>
        <Link className="rounded-md border border-teal-200 bg-teal-50 p-5 shadow-sm hover:border-teal-500" href="/projects">
          <p className="text-sm font-semibold text-teal-800">Planner / Coordinator</p>
          <h2 className="mt-2 text-xl font-semibold text-teal-950">จัดการโครงการ</h2>
          <p className="mt-2 text-sm leading-6 text-teal-900">สร้าง Mission, Assignment, Call Sign และสร้าง QR ให้คนขับ</p>
        </Link>
        <Link className="rounded-md border border-amber-200 bg-amber-50 p-5 shadow-sm hover:border-amber-500" href="/driver">
          <p className="text-sm font-semibold text-amber-800">Driver</p>
          <h2 className="mt-2 text-xl font-semibold text-amber-950">หน้าคนขับ</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">ต้องเปิดจาก QR หรือ URL ที่มี token จึงจะเห็นงานและแชร์ GPS ได้</p>
        </Link>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-ink">เข้าสู่ระบบด้วย Supabase Auth</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">ใช้สำหรับทดสอบ session จริงเท่านั้น RBAC production ยังต้อง harden ก่อนเปิดใช้งานจริง</p>
        <form action={handleEmail} className="mt-4 grid gap-3 md:max-w-md">
          <input className="rounded-md border border-slate-300 px-3 py-2" name="email" placeholder="อีเมล" type="email" />
          <button className="rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="submit">
            ส่งลิงก์เข้าสู่ระบบทางอีเมล
          </button>
        </form>
        <button className="mt-3 w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" onClick={handleGoogle} type="button">
          เข้าสู่ระบบด้วย Google
        </button>
        {message ? <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm font-medium text-slate-700">{message}</p> : null}
      </div>
    </section>
  );
}
