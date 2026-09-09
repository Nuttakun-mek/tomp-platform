"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, TriangleAlert } from "lucide-react";

// Shown in place of a list/section when its read failed (DataResult.ok === false).
// The retry is a client-side `router.refresh()` — it re-runs the server component
// without a full page reload.
export function DataUnavailable({
  title = "ข้อมูลไม่พร้อมใช้งาน",
  description = "โหลดข้อมูลส่วนนี้ไม่สำเร็จ อาจเป็นปัญหาชั่วคราวของการเชื่อมต่อ",
  detail
}: {
  title?: string;
  description?: string;
  detail?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      className="grid justify-items-center gap-3 rounded-panel border border-dashed border-amber-300 bg-amber-50/60 px-6 py-8 text-center"
      role="alert"
    >
      <span className="grid h-11 w-11 place-items-center rounded-panel bg-white text-amber-600 shadow-sm">
        <TriangleAlert className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="card-title text-amber-950">{title}</p>
        <p className="section-description mx-auto mt-1 max-w-sm text-amber-900">{description}</p>
        {detail ? <p className="mx-auto mt-1 max-w-sm text-xs text-amber-700">{detail}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-2xl border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:border-amber-500 disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "กำลังลองใหม่..." : "ลองใหม่"}
      </button>
    </div>
  );
}
