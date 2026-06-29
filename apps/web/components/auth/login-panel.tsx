"use client";

import { useState } from "react";
import { getGoogleSignInUrlAction, signInWithEmailAction } from "@/app/actions/auth";

export function LoginPanel() {
  const [message, setMessage] = useState<string | null>(null);

  async function handleEmail(formData: FormData) {
    const result = await signInWithEmailAction({ email: formData.get("email") });
    setMessage(result.success ? "กรุณาตรวจอีเมลเพื่อเปิดลิงก์เข้าสู่ระบบ" : result.error || "เข้าสู่ระบบไม่สำเร็จ");
  }

  async function handleGoogle() {
    const result = await getGoogleSignInUrlAction();
    if (result.success && result.data && typeof result.data === "object" && "url" in result.data && typeof result.data.url === "string") {
      window.location.href = result.data.url;
      return;
    }
    setMessage(result.error || "ยังไม่ได้ตั้งค่าเข้าสู่ระบบด้วย Google");
  }

  return (
    <section className="grid gap-5 rounded-md border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-ink">เข้าสู่ระบบ</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          รองรับการเข้าสู่ระบบด้วยอีเมลผ่าน Supabase และเตรียมการเชื่อมต่อ Google OAuth สำหรับแนวทาง Zero Cost First ส่วน Enterprise SSO จะทำในระยะถัดไป
        </p>
      </div>
      <form action={handleEmail} className="grid gap-3 md:max-w-md">
        <input className="rounded-md border border-slate-300 px-3 py-2" name="email" placeholder="อีเมล" type="email" />
        <button className="rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="submit">
          เข้าสู่ระบบด้วยอีเมล
        </button>
      </form>
      <button className="w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" onClick={handleGoogle} type="button">
        เข้าสู่ระบบด้วย Google
      </button>
      {message ? <p className="text-sm font-medium text-slate-700">{message}</p> : null}
      <p className="text-xs leading-5 text-slate-500">การใช้งาน production ต้องตรวจสอบ session, RBAC และ SSO เพิ่มเติมก่อนเปิดใช้งานจริง</p>
    </section>
  );
}
