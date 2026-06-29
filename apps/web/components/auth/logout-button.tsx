"use client";

import { useState } from "react";
import { signOutAction } from "@/app/actions/auth";

export function LogoutButton() {
  const [message, setMessage] = useState<string | null>(null);

  async function handleLogout() {
    const result = await signOutAction();
    if (result.success) {
      window.location.href = "/login";
      return;
    }
    setMessage(result.error || "ออกจากระบบไม่สำเร็จ");
  }

  return (
    <div className="grid gap-1">
      <button className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-operation hover:text-operation" onClick={handleLogout} type="button">
        ออกจากระบบ
      </button>
      {message ? <span className="text-xs text-red-700">{message}</span> : null}
    </div>
  );
}
