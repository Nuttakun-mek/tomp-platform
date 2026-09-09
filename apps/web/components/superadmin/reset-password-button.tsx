"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { resetUserPasswordAction } from "@/app/actions/superadmin-users";

export function ResetPasswordButton({ profileId, hasLogin }: { profileId: string; hasLogin: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  if (!hasLogin) {
    return <span className="text-[11px] text-ink-faint">ยังไม่มีบัญชีเข้าสู่ระบบ</span>;
  }

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setResult(null);
    startTransition(async () => {
      const response = await resetUserPasswordAction(profileId);
      if (response.success && response.data && typeof response.data === "object" && "tempPassword" in response.data) {
        setResult({ tone: "ok", text: `รหัสผ่านชั่วคราว: ${String(response.data.tempPassword)}` });
      } else {
        setResult({ tone: "error", text: response.error || "ตั้งรหัสผ่านใหม่ไม่สำเร็จ" });
      }
    });
  }

  return (
    <span className="grid gap-1 sm:justify-items-end">
      <button
        type="button"
        onClick={handleClick}
        onBlur={() => setConfirming(false)}
        disabled={isPending}
        className={`inline-flex items-center gap-1 rounded-command border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
          confirming ? "border-rose-500 bg-rose-500 text-white" : "border-border bg-white text-ink-soft hover:border-operation/40"
        }`}
      >
        <KeyRound className="h-3 w-3" />
        {isPending ? "กำลังออกรหัส..." : confirming ? "กดยืนยัน (รหัสเดิมใช้ไม่ได้ทันที)" : "ตั้งรหัสผ่านใหม่"}
      </button>
      {result ? (
        <span className={`text-[11px] font-semibold ${result.tone === "ok" ? "text-operation" : "text-rose-600"}`}>{result.text}</span>
      ) : null}
    </span>
  );
}
