"use client";

import { useState, useTransition } from "react";
import { signOutAction } from "@/app/actions/auth";

const VARIANT_CLASS = {
  dark: "border-white/10 bg-white/8 text-teal-100 hover:bg-white/12",
  light: "border-border bg-white text-ink-soft hover:border-operation hover:text-operation"
} as const;

export function LogoutButton({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleLogout() {
    setMessage(null);
    startTransition(async () => {
      const result = await signOutAction();
      if (result.success) {
        window.location.href = "/login";
        return;
      }
      setMessage(result.error || "ออกจากระบบไม่สำเร็จ");
    });
  }

  return (
    <div className="grid gap-1">
      <button
        className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-xs font-semibold transition disabled:opacity-60 ${VARIANT_CLASS[variant]}`}
        disabled={isPending}
        onClick={handleLogout}
        type="button"
      >
        {isPending ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
      </button>
      {message ? <span className={`text-xs ${variant === "dark" ? "text-red-200" : "text-danger"}`}>{message}</span> : null}
    </div>
  );
}
