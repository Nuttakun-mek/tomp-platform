"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import type { Assignment } from "@tomp/types/domain";
import { createDriverAccessTokenAction } from "@/app/actions/driver-access";

export function DriverAccessGenerator({ assignments, projectId }: { assignments: Assignment[]; projectId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [accessUrl, setAccessUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const readyAssignments = assignments.filter((assignment) => assignment.callSignId && assignment.driverId && assignment.vehicleId);
  const hasAssignments = assignments.length > 0;
  const hasReadyAssignment = readyAssignments.length > 0;
  const orderedAssignments = [...readyAssignments, ...assignments.filter((assignment) => !readyAssignments.some((ready) => ready.id === assignment.id))];

  useEffect(() => {
    let cancelled = false;
    async function renderQr() {
      if (!accessUrl) {
        setQrDataUrl(null);
        return;
      }
      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(accessUrl, { margin: 2, width: 220, errorCorrectionLevel: "M" });
      if (!cancelled) setQrDataUrl(dataUrl);
    }
    void renderQr();
    return () => {
      cancelled = true;
    };
  }, [accessUrl]);

  function createAccess(formData: FormData) {
    setMessage(null);
    setAccessUrl(null);
    const assignmentId = String(formData.get("assignmentId") || "");
    const assignment = assignments.find((item) => item.id === assignmentId);

    startTransition(async () => {
      const result = await createDriverAccessTokenAction({
        projectId,
        assignmentId,
        driverId: assignment?.driverId || null
      });

      if (!result.success) {
        setMessage(result.error || "สร้างลิงก์ไม่สำเร็จ");
        return;
      }

      const data = result.data as { accessUrl?: string };
      setAccessUrl(data.accessUrl || null);
      setMessage("สร้างลิงก์ QR สำหรับคนขับสำเร็จ ส่งลิงก์นี้ให้คนขับเท่านั้น");
    });
  }

  return (
    <section className="enterprise-panel p-5">
      <h2 className="text-lg font-semibold text-ink">สร้าง QR สำหรับคนขับ</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        เลือก Assignment จริงเพื่อสร้าง token สำหรับคนขับ ระบบจะผูกลิงก์กับ Assignment นี้เท่านั้น และเก็บ token แบบ hash บนฝั่ง server
      </p>

      {hasAssignments ? (
        <form action={createAccess} className="mt-4 grid gap-3">
          <select className="rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm" name="assignmentId" required disabled={!hasReadyAssignment} defaultValue={readyAssignments[0]?.id}>
            {orderedAssignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id} disabled={!assignment.callSignId || !assignment.driverId || !assignment.vehicleId}>
                {assignment.id.slice(0, 8)} | {assignment.status} | {assignment.driverId ? "มีคนขับ" : "ขาดคนขับ"} | {assignment.vehicleId ? "มีรถ" : "ขาดรถ"} | {assignment.callSignId ? "มี Call Sign" : "ขาด Call Sign"}
              </option>
            ))}
          </select>
          {!hasReadyAssignment ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
              ยังไม่มีงานที่พร้อมสร้าง QR กรุณาเลือก Call Sign คนขับ และรถให้ครบใน Assignment ก่อน
            </p>
          ) : null}
          <button className="w-fit rounded-2xl bg-operation px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={isPending || !hasReadyAssignment} type="submit">
            {isPending ? "กำลังสร้าง..." : "สร้างลิงก์และ QR สำหรับคนขับ"}
          </button>
        </form>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">ยังไม่มี Assignment ให้สร้าง QR กรุณาสร้าง Assignment ก่อน หรือใช้หน้า “ทดสอบ GPS สด”</p>
      )}

      {message ? <p className="mt-4 text-sm font-medium text-slate-700">{message}</p> : null}
      {accessUrl ? (
        <div className="mt-3 grid gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 md:grid-cols-[auto_1fr]">
          <div className="flex h-56 w-56 items-center justify-center rounded-2xl border border-blue-200 bg-white p-3">
            {qrDataUrl ? <Image alt="QR สำหรับคนขับ" className="h-full w-full" height={220} src={qrDataUrl} unoptimized width={220} /> : <span className="text-sm font-semibold text-blue-900">กำลังสร้าง QR...</span>}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-blue-900">ลิงก์สำหรับคนขับ</p>
            <a className="mt-2 block break-all text-sm font-semibold text-blue-800 underline" href={accessUrl} target="_blank" rel="noreferrer">
              {accessUrl}
            </a>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <a className="rounded-2xl bg-blue-700 px-4 py-2.5 text-center text-sm font-semibold text-white" href={accessUrl} target="_blank" rel="noreferrer">
                เปิดหน้าคนขับ
              </a>
              <button className="rounded-2xl border border-blue-300 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800" type="button" onClick={() => void navigator.clipboard?.writeText(accessUrl)}>
                คัดลอกลิงก์
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-blue-900">สำหรับ pilot ภายใน สามารถส่งลิงก์นี้ให้คนขับเปิดบนมือถือเพื่อยืนยันงานและแชร์ GPS ได้ทันที</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
