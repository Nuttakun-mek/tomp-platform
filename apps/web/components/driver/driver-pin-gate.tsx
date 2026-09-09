"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { verifyDriverPinAction } from "@/app/actions/driver-pin";

export function DriverPinGate({ token }: { token: string }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyDriverPinAction({ token, pin });
      if (result.success) {
        window.location.reload();
        return;
      }
      setError(result.error || "รหัสไม่ถูกต้อง");
      setPin("");
    });
  }

  return (
    <div className="grid min-h-[70vh] content-center gap-4">
      <div className="grid gap-1 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-operation-soft text-operation">
          <KeyRound className="h-6 w-6" />
        </span>
        <h1 className="mt-2 text-lg font-bold text-ink">กรอกรหัสยืนยัน</h1>
        <p className="mx-auto max-w-xs text-[13px] leading-6 text-ink-soft">
          ศูนย์ควบคุมจะแจ้งรหัส 6 หลักให้คุณแยกจาก QR กรอกรหัสเพื่อเปิดงาน
        </p>
      </div>

      <form onSubmit={submit} className="grid gap-3">
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="rounded-xl border border-slate-300 px-4 py-4 text-center text-2xl font-bold tracking-[0.4em] text-ink outline-none focus:border-operation focus:ring-4 focus:ring-teal-100"
        />
        {error ? <p className="rounded-card bg-rose-50 px-3 py-2 text-center text-[13px] font-semibold text-rose-700">{error}</p> : null}
        <button
          type="submit"
          disabled={isPending || pin.length !== 6}
          className="min-h-13 rounded-xl bg-operation px-4 py-3.5 text-[15px] font-bold text-white disabled:opacity-50"
        >
          {isPending ? "กำลังตรวจสอบ..." : "ยืนยัน"}
        </button>
      </form>
      <p className="text-center text-[12px] text-ink-faint">กรอกผิดเกิน 5 ครั้ง ลิงก์จะถูกล็อก</p>
    </div>
  );
}
