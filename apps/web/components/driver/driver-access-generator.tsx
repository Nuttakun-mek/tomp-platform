"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import type { Assignment } from "@tomp/types/domain";
import { createDriverAccessTokenAction } from "@/app/actions/driver-access";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Tooltip } from "@/components/ui/tooltip";

function labelForAssignment(assignment: Assignment) {
  const vehicleText = assignment.vehicleId ? "มีรถ" : "ขาดรถ";
  const driverText = assignment.driverId ? "มีคนขับ" : "ขาดคนขับ";
  const callSignText = assignment.callSignId ? "มี Call Sign" : "ขาด Call Sign";
  return `งาน ${assignment.id.slice(0, 8)} / ${driverText} / ${vehicleText} / ${callSignText}`;
}

export function DriverAccessGenerator({ assignments, projectId }: { assignments: Assignment[]; projectId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("warning");
  const [accessUrl, setAccessUrl] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const readyAssignments = assignments.filter((assignment) => assignment.callSignId && assignment.driverId && assignment.vehicleId && assignment.status !== "cancelled");
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
    setPin(null);
    const assignmentId = String(formData.get("assignmentId") || "");
    const assignment = assignments.find((item) => item.id === assignmentId);

    if (!assignment) {
      setTone("warning");
      setMessage("กรุณาเลือกงานก่อนสร้าง QR");
      return;
    }

    startTransition(async () => {
      const result = await createDriverAccessTokenAction({
        projectId,
        assignmentId,
        driverId: assignment.driverId || null
      });

      if (!result.success) {
        setTone("danger");
        setMessage(result.error || "สร้าง QR ไม่สำเร็จ");
        return;
      }

      const data = result.data as { accessUrl?: string; pin?: string };
      setAccessUrl(data.accessUrl || null);
      setPin(data.pin || null);
      setTone("success");
      setMessage("สร้าง QR สำเร็จ ส่ง QR และรหัสให้คนขับแยกช่องทางกัน");
    });
  }

  return (
    <section className="enterprise-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">สร้าง QR สำหรับคนขับ</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            QR จะผูกกับโครงการ งานที่จัดสรร คนขับ และรถของงานนั้น คนขับจะเห็นเฉพาะงานของตนเอง
          </p>
        </div>
        <Tooltip content="QR นี้ไม่ใช่ QR ประจำรถ แต่เป็น QR เฉพาะงาน เพื่อจำกัดสิทธิ์และตามประวัติได้">
          <span className="grid h-7 w-7 place-items-center rounded-full border border-slate-300 text-xs font-semibold text-slate-500">?</span>
        </Tooltip>
      </div>

      {hasAssignments ? (
        <form action={createAccess} className="mt-4 grid gap-3">
          <select className="rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm" name="assignmentId" required disabled={!hasReadyAssignment} defaultValue={readyAssignments[0]?.id}>
            {orderedAssignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id} disabled={!assignment.callSignId || !assignment.driverId || !assignment.vehicleId || assignment.status === "cancelled"}>
                {labelForAssignment(assignment)}
              </option>
            ))}
          </select>
          {!hasReadyAssignment ? (
            <ActionFeedback tone="warning" message="ยังไม่มีงานที่พร้อมสร้าง QR กรุณาเลือก Call Sign คนขับ และรถให้ครบก่อน" />
          ) : null}
          <button className="w-fit rounded-2xl bg-operation px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={isPending || !hasReadyAssignment} type="submit">
            {isPending ? "กำลังสร้าง QR..." : "สร้างลิงก์และ QR"}
          </button>
        </form>
      ) : (
        <ActionFeedback tone="warning" message="ยังไม่มีงานที่จัดสรร กรุณาเปิดงานใหม่ก่อนสร้าง QR" />
      )}

      <div className="mt-4">
        <ActionFeedback message={message} tone={tone} />
      </div>

      {accessUrl ? (
        <div className="mt-4 grid gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 md:grid-cols-[auto_1fr]">
          <div className="flex h-56 w-56 items-center justify-center rounded-2xl border border-blue-200 bg-white p-3">
            {qrDataUrl ? <Image alt="QR สำหรับคนขับ" className="h-full w-full" height={220} src={qrDataUrl} unoptimized width={220} /> : <span className="text-sm font-semibold text-blue-900">กำลังสร้าง QR...</span>}
          </div>
          <div className="min-w-0">
            {pin ? (
              <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">รหัสยืนยัน 6 หลัก</p>
                <p className="mt-0.5 text-3xl font-bold tracking-[0.3em] text-amber-900">{pin}</p>
                <p className="mt-1 text-[11px] leading-4 text-amber-700">บอกคนขับด้วยวาจา/โทร แยกจาก QR อย่าส่งพร้อมกัน</p>
              </div>
            ) : null}
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
            <p className="mt-3 text-xs leading-5 text-blue-900">
              เมื่อคนขับเปิดลิงก์ จะเห็นงานของตนเอง ยืนยันความพร้อม และแชร์ GPS กลับศูนย์ควบคุมได้
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
