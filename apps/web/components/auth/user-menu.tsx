"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { LogIn, LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { roleLabelTh } from "@/lib/i18n/role-th";

function initials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

interface UserMenuProps {
  name: string;
  email: string | null;
  roleKey: string | null;
  signedIn: boolean;
  variant?: "dark" | "light";
}

// Always-visible identity block so the viewer can immediately tell they are
// signed in, as whom, and how to sign out.
export function UserMenu({ name, email, roleKey, signedIn, variant = "dark" }: UserMenuProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dark = variant === "dark";

  if (!signedIn) {
    return (
      <Link
        href="/login"
        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-[13px] font-semibold transition ${
          dark ? "border-white/15 bg-white/10 text-teal-100 hover:bg-white/15" : "border-border bg-white text-operation hover:border-operation"
        }`}
      >
        <LogIn className="h-4 w-4" /> เข้าสู่ระบบ
      </Link>
    );
  }

  function handleLogout() {
    setError(null);
    startTransition(async () => {
      const result = await signOutAction();
      if (result.success) {
        window.location.href = "/login";
        return;
      }
      setError(result.error || "ออกจากระบบไม่สำเร็จ");
    });
  }

  return (
    <div className={`grid gap-2 rounded-xl border p-2.5 ${dark ? "border-white/10 bg-white/[0.06]" : "border-border bg-white"}`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold ${dark ? "bg-teal-300 text-teal-950" : "bg-operation-soft text-operation"}`}>
          {initials(name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[13px] font-semibold ${dark ? "text-white" : "text-ink"}`}>{name}</span>
          <span className={`block truncate text-[11px] ${dark ? "text-slate-400" : "text-ink-faint"}`}>
            {roleLabelTh(roleKey)}
            {email ? ` · ${email}` : ""}
          </span>
        </span>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isPending}
          title="ออกจากระบบ"
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition disabled:opacity-50 ${
            dark ? "border-white/10 text-slate-300 hover:bg-white/10 hover:text-white" : "border-border text-ink-soft hover:border-rose-300 hover:text-rose-600"
          }`}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      {error ? <span className={`text-[11px] ${dark ? "text-rose-200" : "text-rose-600"}`}>{error}</span> : null}
    </div>
  );
}
