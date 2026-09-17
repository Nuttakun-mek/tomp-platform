"use client";

import { useActionState } from "react";
import { Ban, Trash2 } from "lucide-react";
import { cancelAirportTransferCase, trashAirportTransferCase, type CaseLifecycleState } from "@/app/airport-transfer/actions";
import { Button } from "@/components/ui/button";
import type { AirportTransferOperationalStatus } from "@/lib/airport-transfer/types";

const initialState: CaseLifecycleState = { ok: false, message: "" };

export function CaseLifecycleActions({ caseId, status }: { caseId: string; status: AirportTransferOperationalStatus }) {
  const [cancelState, cancelAction, cancelling] = useActionState(cancelAirportTransferCase.bind(null, caseId), initialState);
  const [trashState, trashAction, trashing] = useActionState(trashAirportTransferCase.bind(null, caseId), initialState);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">จัดการเคส</h2>
      <p className="mt-1 text-xs text-slate-500">การยกเลิกและย้ายไปถังขยะจะเก็บประวัติทั้งหมดไว้</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {status !== "cancelled" ? (
          <form action={cancelAction} className="grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3" onSubmit={(event) => { if (!window.confirm("ยืนยันยกเลิกงานนี้? ระบบจะหยุดติดตามเที่ยวบินของเคส")) event.preventDefault(); }}>
            <label className="text-xs font-semibold text-amber-900">เหตุผลที่ยกเลิก<input name="reason" required className="mt-1.5 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm" /></label>
            <Button type="submit" variant="secondary" className="gap-2" disabled={cancelling}><Ban className="h-4 w-4" />{cancelling ? "กำลังยกเลิก..." : "ยกเลิกงาน"}</Button>
            {cancelState.message ? <p className={`text-xs ${cancelState.ok ? "text-emerald-700" : "text-red-700"}`}>{cancelState.message}</p> : null}
          </form>
        ) : <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">งานนี้ถูกยกเลิกแล้ว</div>}
        <form action={trashAction} className="grid gap-2 rounded-xl border border-red-200 bg-red-50 p-3" onSubmit={(event) => { if (!window.confirm("ยืนยันย้ายเคสนี้ไปยังข้อมูลที่ลบแล้ว?")) event.preventDefault(); }}>
          <label className="text-xs font-semibold text-red-900">เหตุผลที่ลบ (ถ้ามี)<input name="reason" className="mt-1.5 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm" /></label>
          <Button type="submit" variant="danger" className="gap-2" disabled={trashing}><Trash2 className="h-4 w-4" />{trashing ? "กำลังย้าย..." : "ย้ายไปข้อมูลที่ลบแล้ว"}</Button>
          {trashState.message ? <p className={`text-xs ${trashState.ok ? "text-emerald-700" : "text-red-700"}`}>{trashState.message}</p> : null}
        </form>
      </div>
    </section>
  );
}
