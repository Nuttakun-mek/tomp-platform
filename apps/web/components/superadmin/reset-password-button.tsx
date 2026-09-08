"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { resetUserPasswordAction } from "@/app/actions/superadmin-users";

export function ResetPasswordButton({ profileId, hasLogin }: { profileId: string; hasLogin: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  if (!hasLogin) {
    return <span className="text-[11px] text-ink-faint">ยังไม่มีบัญชีเข้าสู่ระบบ</span>;
  }

  function handleClick() {
    if (!window.confirm("ออกรหัสผ่านชั่วคราวใหม่ให้ผู้ใช้นี้? รหัสเดิมจะใช้ไม่ได้ทันที")) return;
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
        disabled={isPending}
        className="inline-flex items-center gap-1 rounded-command border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-soft transition hover:border-operation/40 disabled:opacity-50"
      >
        <KeyRound className="h-3 w-3" />
        {isPending ? "กำลังออกรหัส..." : "ตั้งรหัสผ่านใหม่"}
      </button>
      {result ? (
        <span className={`text-[11px] font-semibold ${result.tone === "ok" ? "text-operation" : "text-rose-600"}`}>{result.text}</span>
      ) : null}
    </span>
  );
}
