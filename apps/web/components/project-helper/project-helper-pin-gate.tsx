"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { verifyProjectHelperPinAction } from "@/app/actions/project-helper";

// Mirrors apps/web/components/driver/driver-pin-gate.tsx's form-and-cookie
// pattern: a numeric PIN entered here is checked server-side, which sets an
// httpOnly cookie scoped to this claim link and the browser is then just
// asked to re-render (router.refresh()) rather than navigate — the page
// component reads the cookie on the next render and swaps in the real view.
// The one real difference from the driver gate: a helper's PIN is 4-6 digits
// (set by whoever issued the link), not a fixed 6, so length isn't used to
// gate the submit button — only "has the operator typed something".
export function ProjectHelperPinGate({ token }: { token: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyProjectHelperPinAction({ token, pin });
      if (result.success) {
        router.refresh();
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
        <p className="mx-auto max-w-xs text-[13px] leading-6 text-ink-soft">ผู้จัดการโครงการจะแจ้งรหัส PIN ให้คุณแยกจากลิงก์นี้ กรอกรหัสเพื่อเข้าใช้งาน</p>
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
          disabled={isPending || pin.length < 4}
          className="min-h-13 rounded-xl bg-operation px-4 py-3.5 text-[15px] font-bold text-white disabled:opacity-50"
        >
          {isPending ? "กำลังตรวจสอบ..." : "ยืนยัน"}
        </button>
      </form>
    </div>
  );
}
