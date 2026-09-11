"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { verifyFleetPinAction } from "@/app/actions/fleet-pin";
import { Button } from "@/components/ui/button";
import type { LocaleCode } from "@/lib/i18n/locales";

const copy = {
  th: {
    title: "ยืนยันรหัส PIN",
    body: "ลิงก์นี้ถูกป้องกันด้วยรหัส PIN กรุณากรอกรหัส 6 หลักที่ได้รับจากศูนย์ควบคุม",
    label: "รหัส PIN",
    submit: "เปิดหน้าติดตามรถ",
    required: "กรุณากรอกรหัส PIN",
    wrong: "รหัส PIN ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
    tooMany: "กรอกรหัสผิดหลายครั้ง กรุณารอสักครู่แล้วลองใหม่",
    unlocked: "ยืนยันสำเร็จ กำลังเปิดหน้าติดตาม"
  },
  en: {
    title: "Verify PIN",
    body: "This link is protected. Enter the 6-digit PIN from the control centre.",
    label: "PIN",
    submit: "Open Fleet View",
    required: "Please enter the PIN.",
    wrong: "The PIN is not correct.",
    tooMany: "Too many failed attempts. Please wait and try again.",
    unlocked: "Verified. Opening fleet view."
  }
} as const;

function messageFor(locale: LocaleCode, code: string) {
  if (code === "fleet.pin.tooMany") return copy[locale].tooMany;
  if (code === "fleet.pin.required") return copy[locale].required;
  if (code === "fleet.pin.unlocked") return copy[locale].unlocked;
  return copy[locale].wrong;
}

export function FleetPinGate({ token, locale }: { token: string; locale: LocaleCode }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "danger">("danger");
  const [isPending, startTransition] = useTransition();
  const c = copy[locale];

  function submit() {
    startTransition(async () => {
      const result = await verifyFleetPinAction({ token, pin });
      const code = result.success ? result.data?.code ?? "fleet.pin.unlocked" : result.fieldErrors?.code?.[0] ?? result.error ?? "fleet.pin.wrong";
      setTone(result.success ? "success" : "danger");
      setMessage(messageFor(locale, code));
      if (result.success) router.refresh();
    });
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
      <section className="mx-auto flex max-w-md flex-col rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-300/40">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-700">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold">{c.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{c.body}</p>
        <label className="mt-6 text-sm font-semibold text-slate-700" htmlFor="fleet-pin">
          {c.label}
        </label>
        <input
          id="fleet-pin"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className="mt-2 h-14 rounded-2xl border border-slate-300 bg-white px-4 text-center text-2xl font-bold tracking-[0.25em] outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
        />
        {message ? (
          <p className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {message}
          </p>
        ) : null}
        <Button className="mt-5 h-12 rounded-2xl" disabled={isPending || pin.length < 6} onClick={submit}>
          {isPending ? "..." : c.submit}
        </Button>
      </section>
    </main>
  );
}
