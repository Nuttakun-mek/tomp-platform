"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { KeyRound, Mail } from "lucide-react";
import { getGoogleSignInUrlAction, signInWithEmailAction, signInWithPasswordAction } from "@/app/actions/auth";

export function LoginPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const reason = searchParams.get("reason");
  // Email sign-in (magic link + Google) is opt-in — only once Supabase Site URL /
  // redirect URLs / SMTP are configured for this environment.
  const emailAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_EMAIL_LOGIN === "1";
  const [mode, setMode] = useState<"password" | "magic-link">("password");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    reason === "missing-auth-config" ? { tone: "error", text: "ยังไม่ได้ตั้งค่า Supabase Auth บนระบบ" } : null
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
        text: result.success ? "ส่งลิงก์เข้าสู่ระบบไปที่อีเมลแล้ว" : result.error || "เข้าสู่ระบบไม่สำเร็จ"
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

  const inputClass =
    "min-h-12 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-operation focus:ring-4 focus:ring-teal-100";

  return (
    <section className="mx-auto grid min-h-screen w-full max-w-sm content-center gap-6 px-4 py-10">
      <div className="grid gap-1 text-center">
        <p className="text-[12px] font-bold tracking-[0.24em] text-operation">TOMP</p>
        <h1 className="text-lg font-semibold text-ink">ระบบบริหารจัดการการเดินทางและบริการ</h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-ink">เข้าสู่ระบบ</h2>

        {mode === "password" ? (
          <form action={handlePassword} className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-[13px] font-semibold text-slate-700">
              อีเมล
              <input className={inputClass} name="email" placeholder="name@company.com" type="email" autoComplete="email" required />
            </label>
            <label className="grid gap-1.5 text-[13px] font-semibold text-slate-700">
              รหัสผ่าน
              <input className={inputClass} name="password" type="password" autoComplete="current-password" required />
            </label>
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-operation px-4 py-3 text-sm font-semibold text-white transition hover:bg-operation-deep disabled:bg-slate-300"
              disabled={isPending}
              type="submit"
            >
              <KeyRound className="h-4 w-4" />
              {isPending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>
        ) : (
          <form action={handleEmail} className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-[13px] font-semibold text-slate-700">
              อีเมล
              <input className={inputClass} name="email" placeholder="name@company.com" type="email" autoComplete="email" required />
            </label>
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-operation px-4 py-3 text-sm font-semibold text-white transition hover:bg-operation-deep disabled:bg-slate-300"
              disabled={isPending}
              type="submit"
            >
              <Mail className="h-4 w-4" />
              {isPending ? "กำลังส่งลิงก์..." : "ส่งลิงก์เข้าสู่ระบบ"}
            </button>
          </form>
        )}

        {emailAuthEnabled ? (
          <div className="mt-3 grid gap-2">
            <button
              className="text-[13px] font-semibold text-operation transition hover:text-operation-deep"
              onClick={() => {
                setMessage(null);
                setMode((current) => (current === "password" ? "magic-link" : "password"));
              }}
              type="button"
            >
              {mode === "password" ? "ใช้ลิงก์ทางอีเมลแทน" : "ใช้รหัสผ่านแทน"}
            </button>
            <button
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-operation"
              disabled={isPending}
              onClick={handleGoogle}
              type="button"
            >
              เข้าสู่ระบบด้วย Google
            </button>
          </div>
        ) : null}

        {message ? (
          <p
            className={`mt-4 rounded-xl border p-3 text-[13px] font-semibold leading-6 ${
              message.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            {message.text}
          </p>
        ) : null}
      </div>

      <p className="text-center text-[12px] text-slate-400">คนขับเปิดงานจากลิงก์ QR ที่ศูนย์ควบคุมส่งให้</p>
    </section>
  );
}
