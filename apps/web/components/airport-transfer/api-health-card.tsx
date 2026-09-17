"use client";

import { useEffect, useState, useTransition } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { runAirportTransferFlightSync } from "@/app/airport-transfer/actions";
import { Button } from "@/components/ui/button";
import type { AirportTransferApiHealth } from "@/lib/airport-transfer/types";
import { useRouter } from "next/navigation";

const labels: Record<AirportTransferApiHealth["connectionStatus"], string> = {
  not_configured: "ยังไม่ได้ตั้งค่า API",
  idle: "เชื่อมต่อพร้อม · ไม่มีงานที่ต้องติดตาม",
  checking: "กำลังตรวจข้อมูลเที่ยวบิน",
  healthy: "API ทำงานปกติ",
  degraded: "API ทำงานบางส่วน",
  error: "การเชื่อมต่อมีปัญหา",
  paused: "หยุดติดตามชั่วคราว"
};

const colors: Record<AirportTransferApiHealth["connectionStatus"], string> = {
  not_configured: "bg-slate-100 text-slate-700",
  idle: "bg-blue-50 text-blue-800",
  checking: "bg-cyan-50 text-cyan-800",
  healthy: "bg-emerald-50 text-emerald-800",
  degraded: "bg-amber-50 text-amber-800",
  error: "bg-red-50 text-red-800",
  paused: "bg-slate-100 text-slate-600"
};

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

export function AirportTransferApiHealthCard({ health }: { health: AirportTransferApiHealth | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const status = health?.connectionStatus || "not_configured";

  function syncNow(silent = false) {
    if (pending) return;
    startTransition(async () => {
      const result = await runAirportTransferFlightSync({ ok: false, message: "" });
      if (!silent || !result.ok) setMessage(result.message);
      router.refresh();
    });
  }

  useEffect(() => {
    if (!health?.pollingEnabled) return;
    const due = !health.nextCheckAt || new Date(health.nextCheckAt).getTime() <= Date.now();
    if (due && document.visibilityState === "visible") syncNow(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") syncNow(true);
    }, Math.max(5, health.pollingIntervalMinutes) * 60 * 1000);
    return () => window.clearInterval(timer);
    // Health timestamps intentionally reset the interval after each server refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [health?.pollingEnabled, health?.pollingIntervalMinutes, health?.nextCheckAt]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${colors[status]}`}><Activity className="h-5 w-5" /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">สถานะ Flight API</h2><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[status]}`}>{pending ? "กำลังตรวจสอบ" : labels[status]}</span></div>
            <p className="mt-1 text-xs text-slate-500">ติดตาม {health?.activeCaseCount || 0} เคส · ตรวจสำเร็จรอบล่าสุด {health?.checkedCaseCount || 0} · ผิดพลาด {health?.failedCaseCount || 0}</p>
            <p className="mt-1 text-xs text-slate-500">ตรวจล่าสุด {formatTime(health?.lastCheckAt || null)} · รอบถัดไป {health?.activeCaseCount ? formatTime(health?.nextCheckAt || null) : "หยุดจนกว่าจะมีงาน"}</p>
            {health?.lastErrorMessage ? <p className="mt-1 text-xs text-red-700">{health.lastErrorMessage}</p> : null}
            {message ? <p className="mt-1 text-xs text-slate-600">{message}</p> : null}
          </div>
        </div>
        <Button type="button" variant="secondary" className="gap-2" disabled={pending} onClick={() => syncNow(false)}><RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />ตรวจตอนนี้</Button>
      </div>
    </section>
  );
}
