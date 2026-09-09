"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { purgeTestDataAction } from "@/app/actions/superadmin-purge";
import type { PurgeCounts } from "@/lib/superadmin/purge-test-data";

export function PurgeTestDataPanel({ counts }: { counts: PurgeCounts }) {
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      const response = await purgeTestDataAction({ confirm });
      if (response.success) {
        const deleted = (response.data as { deleted: PurgeCounts }).deleted;
        const n = Object.values(deleted).reduce((s, x) => s + x, 0);
        setResult({ tone: "ok", text: `ลบข้อมูลทดสอบแล้ว ${n} รายการ (ข้อมูลที่เกี่ยวข้องถูกลบตาม)` });
        setConfirm("");
      } else {
        setResult({ tone: "error", text: response.error || "ล้างข้อมูลไม่สำเร็จ" });
      }
    });
  }

  return (
    <section className="enterprise-panel grid gap-4 p-4">
      <div>
        <h2 className="card-title">ข้อมูลทดสอบในระบบ</h2>
        <p className="section-description mt-1">ลบเฉพาะแถวที่เครื่องมือทดสอบสร้าง (ติดแท็ก smokeTest) — ไม่แตะข้อมูลจริง</p>
      </div>

      <dl className="grid gap-1.5 rounded-card border border-border bg-white p-3 text-[13px]">
        {Object.entries(counts).map(([table, n]) => (
          <div key={table} className="flex items-center justify-between">
            <dt className="text-ink-soft">{table}</dt>
            <dd className={`font-semibold ${n > 0 ? "text-ink" : "text-ink-faint"}`}>{n}</dd>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5">
          <dt className="font-semibold text-ink">รวม</dt>
          <dd className="font-bold text-ink">{total}</dd>
        </div>
      </dl>

      {total === 0 ? (
        <p className="rounded-card bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-800">ไม่มีข้อมูลทดสอบค้างในระบบ</p>
      ) : (
        <form onSubmit={submit} className="grid gap-2.5">
          <label className="field-label">
            {"พิมพ์ “ล้างข้อมูลทดสอบ” เพื่อยืนยัน"}
            <input className="field-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="ล้างข้อมูลทดสอบ" />
          </label>
          <button
            type="submit"
            disabled={isPending || confirm.trim() !== "ล้างข้อมูลทดสอบ"}
            className="inline-flex w-fit items-center gap-2 rounded-command bg-rose-600 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {isPending ? "กำลังล้าง..." : `ล้างข้อมูลทดสอบ ${total} รายการ`}
          </button>
        </form>
      )}

      {result ? (
        <p className={`rounded-card px-3 py-2 text-[13px] font-semibold ${result.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
          {result.text}
        </p>
      ) : null}
    </section>
  );
}
