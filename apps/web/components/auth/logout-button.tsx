"use client";

import { useState, useTransition } from "react";
import { signOutAction } from "@/app/actions/auth";

export function LogoutButton() {
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
      <button className="rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-semibold text-teal-100 transition hover:bg-white/12 disabled:opacity-60" disabled={isPending} onClick={handleLogout} type="button">
        {isPending ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
      </button>
      {message ? <span className="text-xs text-red-200">{message}</span> : null}
    </div>
  );
}
