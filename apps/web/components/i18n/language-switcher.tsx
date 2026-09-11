"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";
import { LOCALE_COOKIE, type LocaleCode } from "@/lib/i18n/locales";

export function LanguageSwitcher({ locale, variant = "light" }: { locale: LocaleCode; variant?: "light" | "dark" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dark = variant === "dark";

  function change(nextLocale: LocaleCode) {
    if (nextLocale === locale) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", nextLocale);
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    window.location.assign(`${pathname}?${params.toString()}`);
  }

  return (
    <div
      className={`flex items-center gap-1 rounded-full border p-1 text-[11px] font-bold ${
        dark ? "border-white/10 bg-white/[0.06] text-slate-200" : "border-slate-200 bg-white text-slate-700"
      }`}
      aria-label="Language"
    >
      <Languages className="ml-1 h-3.5 w-3.5 shrink-0 opacity-75" />
      {(["th", "en"] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => change(item)}
          aria-pressed={locale === item}
          className={`rounded-full px-2 py-1 transition ${
            locale === item
              ? dark
                ? "bg-teal-300 text-teal-950"
                : "bg-operation text-white"
              : dark
                ? "text-slate-300 hover:bg-white/10"
                : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
