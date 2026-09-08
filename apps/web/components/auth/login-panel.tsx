"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, KeyRound, LockKeyhole, Mail, MapPinned, ShieldCheck, UserRoundCheck } from "lucide-react";
import { getGoogleSignInUrlAction, signInWithEmailAction, signInWithPasswordAction } from "@/app/actions/auth";

const roleCards = [
  {
    title: "ผู้ดูแลระบบและศูนย์ควบคุม",
    body: "เห็นโครงการที่มีสิทธิ์ ติดตามรถ คนขับ GPS งาน และรายการที่ต้องตัดสินใจ",
    icon: ShieldCheck
  },
  {
    title: "ผู้วางแผนและผู้ประสานงาน",
    body: "สร้างโครงการ ภารกิจ งานที่จัดสรร Call Sign และ QR สำหรับส่งงานให้คนขับ",
    icon: MapPinned
  },
  {
    title: "คนขับ",
    body: "ไม่ต้องเข้าใช้จากหน้านี้ ให้เปิดงานจาก QR ที่ผูกกับโครงการ รถ และงานที่ได้รับเท่านั้น",
    icon: UserRoundCheck
  }
];

export function LoginPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const reason = searchParams.get("reason");
  // Email-based sign-in (magic link + Google) is opt-in — only meaningful once
  // Supabase Site URL / redirect URLs / SMTP are configured for this environment.
  const emailAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_EMAIL_LOGIN === "1";
  const [mode, setMode] = useState<"password" | "magic-link">("password");
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(
    reason === "missing-auth-config" ? { tone: "error", text: "ยังไม่ได้ตั้งค่า Supabase Auth บนระบบ production" } : null
  );
  const [isPending, startTransition] = useTransition();

  function handlePassword(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await signInWithPasswordAction({ email: formData.get("email"), password: formData.get("password"), next });
      if (result.success && result.data && typeof result.data === "object" && "redirectTo" in result.data) {
        router.replace(String(result.data.redirectTo));
        return;
      }
      setMessage({ tone: "error", text: result.error || "เข้าสู่ระบบไม่สำเร็จ" });
    });
  }

  function handleEmail(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await signInWithEmailAction({ email: formData.get("email"), next });
      setMessage({
        tone: result.success ? "success" : "error",
        text: result.success ? "ส่งลิงก์เข้าสู่ระบบไปที่อีเมลแล้ว กรุณาเปิดอีเมลเพื่อยืนยันตัวตน" : result.error || "เข้าสู่ระบบไม่สำเร็จ"
      });
    });
  }

  function handleGoogle() {
    setMessage(null);
    startTransition(async () => {
      const result = await getGoogleSignInUrlAction({ next });
      if (result.success && result.data && typeof result.data === "object" && "url" in result.data && typeof result.data.url === "string") {
        window.location.href = result.data.url;
        return;
      }
      setMessage({ tone: "error", text: result.error || "ยังไม่ได้ตั้งค่า Google OAuth" });
    });
  }

  const messageClass =
    message?.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : message?.tone === "error"
        ? "border-red-200 bg-red-50 text-red-900"
        : "border-blue-200 bg-blue-50 text-blue-900";

  return (
    <section className="mx-auto grid min-h-[calc(100vh-72px)] w-full max-w-6xl content-center gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[32px] bg-slate-950 text-white shadow-command">
        <div className="command-grid grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-300/25 bg-teal-300/10 px-3 py-1.5 text-[12px] font-semibold text-teal-100">
              <LockKeyhole className="h-4 w-4" />
              เข้าสู่ระบบ TOMP
            </div>
            <h1 className="mt-5 max-w-2xl text-[30px] font-semibold leading-tight sm:text-[40px]">เริ่มงานจากบัญชีที่ได้รับสิทธิ์</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              เจ้าหน้าที่ต้องเข้าสู่ระบบก่อนใช้งาน เพื่อแยกสิทธิ์ตามโครงการ ลดความสับสนระหว่างข้อมูลจริงกับเครื่องมือทดสอบ และควบคุมการเข้าถึงข้อมูลคนขับอย่างถูกต้อง
            </p>

            <div className="mt-6 grid gap-3">
              {roleCards.map((role) => {
                const Icon = role.icon;
                return (
                  <article key={role.title} className="rounded-[22px] border border-white/10 bg-white/[0.07] p-4">
                    <div className="flex gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-teal-100">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-semibold text-white">{role.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{role.body}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="border-t border-white/10 bg-white p-5 text-ink lg:border-l lg:border-t-0 lg:p-6">
            <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
              <p className="page-kicker">บัญชีเจ้าหน้าที่</p>
              <h2 className="mt-1 text-2xl font-semibold text-ink">เข้าสู่ระบบ</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {mode === "password"
                  ? "กรอกอีเมลและรหัสผ่านที่ได้รับจากผู้ดูแลระบบ"
                  : "กรอกอีเมลที่เปิดใช้งานไว้ ระบบจะส่งลิงก์สำหรับยืนยันตัวตน"}
              </p>

              {mode === "password" ? (
                <form action={handlePassword} className="mt-5 grid gap-3">
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    อีเมล
                    <input className="min-h-12 rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-operation focus:ring-4 focus:ring-teal-100" name="email" placeholder="name@company.com" type="email" autoComplete="email" required />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    รหัสผ่าน
                    <input className="min-h-12 rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-operation focus:ring-4 focus:ring-teal-100" name="password" type="password" autoComplete="current-password" required />
                  </label>
                  <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-operation px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(8,123,115,0.24)] transition hover:bg-operation-deep disabled:bg-slate-300" disabled={isPending} type="submit">
                    <KeyRound className="h-4 w-4" />
                    {isPending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                  </button>
                </form>
              ) : (
                <form action={handleEmail} className="mt-5 grid gap-3">
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    อีเมล
                    <input className="min-h-12 rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-operation focus:ring-4 focus:ring-teal-100" name="email" placeholder="name@company.com" type="email" autoComplete="email" required />
                  </label>
                  <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-operation px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(8,123,115,0.24)] transition hover:bg-operation-deep disabled:bg-slate-300" disabled={isPending} type="submit">
                    <Mail className="h-4 w-4" />
                    {isPending ? "กำลังส่งลิงก์..." : "ส่งลิงก์เข้าสู่ระบบ"}
                  </button>
                </form>
              )}

              {emailAuthEnabled ? (
                <>
                  <button
                    className="mt-2 text-[13px] font-semibold text-operation transition hover:text-operation-deep"
                    onClick={() => {
                      setMessage(null);
                      setMode((current) => (current === "password" ? "magic-link" : "password"));
                    }}
                    type="button"
                  >
                    {mode === "password" ? "ใช้ลิงก์ทางอีเมลแทน" : "ใช้รหัสผ่านแทน"}
                  </button>

                  <button className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-operation hover:bg-teal-50" disabled={isPending} onClick={handleGoogle} type="button">
                    เข้าสู่ระบบด้วย Google
                  </button>
                </>
              ) : (
                <p className="mt-3 text-[13px] leading-6 text-slate-500">
                  ลืมรหัสผ่าน? ติดต่อผู้ดูแลระบบเพื่อออกรหัสผ่านชั่วคราวใหม่
                </p>
              )}

              {message ? <p className={`mt-4 rounded-2xl border p-3 text-sm font-semibold leading-6 ${messageClass}`}>{message.text}</p> : null}

              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                คนขับไม่ต้องเข้าจากหน้านี้ ให้เปิดจาก QR ที่ศูนย์ควบคุมส่งให้เท่านั้น
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-operation hover:bg-teal-50" href="/driver">
          ไปหน้าคนขับ
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
