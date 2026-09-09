"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { Copy, FileText, KeyRound, QrCode } from "lucide-react";
import type { Assignment } from "@tomp/types/domain";
import { createDriverAccessTokenAction } from "@/app/actions/driver-access";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Tooltip } from "@/components/ui/tooltip";

interface GeneratedAccess {
  assignmentId: string;
  label: string;
  accessUrl: string;
  pin: string | null;
  qrDataUrl: string | null;
}

function labelForAssignment(assignment: Assignment) {
  const vehicleText = assignment.vehicleId ? "มีรถ" : "ขาดรถ";
  const driverText = assignment.driverId ? "มีคนขับ" : "ขาดคนขับ";
  const callSignText = assignment.callSignId ? "มี Call Sign" : "ขาด Call Sign";
  return `งาน ${assignment.id.slice(0, 8)} / ${driverText} / ${vehicleText} / ${callSignText}`;
}

async function renderQr(accessUrl: string, width = 220) {
  const QRCode = await import("qrcode");
  return QRCode.toDataURL(accessUrl, { margin: 2, width, errorCorrectionLevel: "M" });
}

export function DriverAccessGenerator({ assignments, projectId }: { assignments: Assignment[]; projectId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("warning");
  const [selectedAccess, setSelectedAccess] = useState<GeneratedAccess | null>(null);
  const [bulkAccess, setBulkAccess] = useState<GeneratedAccess[]>([]);
  const [isPending, startTransition] = useTransition();
  const readyAssignments = assignments.filter((assignment) => assignment.callSignId && assignment.driverId && assignment.vehicleId && assignment.status !== "cancelled");
  const hasAssignments = assignments.length > 0;
  const hasReadyAssignment = readyAssignments.length > 0;
  const orderedAssignments = [...readyAssignments, ...assignments.filter((assignment) => !readyAssignments.some((ready) => ready.id === assignment.id))];

  useEffect(() => {
    if (!selectedAccess?.accessUrl || selectedAccess.qrDataUrl) return;
    let cancelled = false;
    void renderQr(selectedAccess.accessUrl).then((qrDataUrl) => {
      if (!cancelled) setSelectedAccess((current) => current ? { ...current, qrDataUrl } : current);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedAccess]);

  function applyResult(resultData: { accessUrl?: string; pin?: string }, assignmentId: string): GeneratedAccess {
    const assignment = assignments.find((item) => item.id === assignmentId);
    return {
      assignmentId,
      label: assignment ? labelForAssignment(assignment) : `งาน ${assignmentId.slice(0, 8)}`,
      accessUrl: resultData.accessUrl || "",
      pin: resultData.pin || null,
      qrDataUrl: null
    };
  }

  function createAccess(formData: FormData) {
    setMessage(null);
    setSelectedAccess(null);
    const assignmentId = String(formData.get("assignmentId") || "");
    const assignment = assignments.find((item) => item.id === assignmentId);

    if (!assignment) {
      setTone("warning");
      setMessage("โปรดเลือกงานก่อนสร้าง QR");
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
        setMessage(result.error || "ไม่สามารถสร้าง QR ได้");
        return;
      }

      const access = applyResult(result.data as { accessUrl?: string; pin?: string }, assignmentId);
      setSelectedAccess(access);
      setTone("success");
      setMessage("สร้าง QR และรหัสยืนยันสำเร็จ โปรดส่ง QR และรหัสยืนยันแยกช่องทาง");
    });
  }

  function createBulkAccess() {
    setMessage(null);
    setBulkAccess([]);
    if (!readyAssignments.length) {
      setTone("warning");
      setMessage("ยังไม่มีงานที่พร้อมสร้าง QR");
      return;
    }

    startTransition(async () => {
      const generated: GeneratedAccess[] = [];
      const errors: string[] = [];

      for (const assignment of readyAssignments) {
        const result = await createDriverAccessTokenAction({
          projectId,
          assignmentId: assignment.id,
          driverId: assignment.driverId || null
        });

        if (!result.success) {
          errors.push(`${assignment.id.slice(0, 8)}: ${result.error || "ไม่สำเร็จ"}`);
          continue;
        }

        const access = applyResult(result.data as { accessUrl?: string; pin?: string }, assignment.id);
        access.qrDataUrl = access.accessUrl ? await renderQr(access.accessUrl, 160) : null;
        generated.push(access);
      }

      setBulkAccess(generated);
      if (errors.length) {
        setTone("warning");
        setMessage(`สร้าง QR สำเร็จ ${generated.length} งาน และไม่สำเร็จ ${errors.length} งาน`);
      } else {
        setTone("success");
        setMessage(`สร้าง QR สำเร็จทั้งหมด ${generated.length} งาน`);
      }
    });
  }

  const activeAccess = selectedAccess;

  return (
    <section className="enterprise-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">สร้าง QR สำหรับคนขับ</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            QR ผูกกับโครงการ งานที่จัดสรร คนขับ และรถของงานนั้น คนขับจะเห็นเฉพาะงานที่ได้รับมอบหมาย
          </p>
        </div>
        <Tooltip content="QR นี้เป็น QR เฉพาะงาน เพื่อจำกัดสิทธิ์และตรวจสอบประวัติได้ ไม่ใช่ QR ประจำรถ">
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
            <ActionFeedback tone="warning" message="ยังไม่มีงานที่พร้อมสร้าง QR โปรดเลือก Call Sign คนขับ และรถให้ครบก่อน" />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-operation px-5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={isPending || !hasReadyAssignment} type="submit">
              <QrCode className="h-4 w-4" />
              {isPending ? "กำลังสร้าง..." : "สร้าง QR งานที่เลือก"}
            </button>
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-operation/30 bg-white px-5 text-sm font-semibold text-operation disabled:opacity-50" disabled={isPending || !hasReadyAssignment} type="button" onClick={createBulkAccess}>
              <FileText className="h-4 w-4" />
              สร้าง QR ทุกงานที่พร้อม
            </button>
          </div>
        </form>
      ) : (
        <ActionFeedback tone="warning" message="ยังไม่มีงานที่จัดสรร โปรดเปิดงานใหม่ก่อนสร้าง QR" />
      )}

      <div className="mt-4">
        <ActionFeedback message={message} tone={tone} />
      </div>

      {activeAccess?.accessUrl ? <AccessCard access={activeAccess} /> : null}

      {bulkAccess.length ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-ink">ชุด QR สำหรับส่งให้คนขับ</h3>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{bulkAccess.length} งาน</span>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-operation hover:text-operation"
              >
                พิมพ์ชุด QR/PIN
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {bulkAccess.map((access) => <AccessCard key={access.assignmentId} access={access} compact />)}
          </div>
          <PrintableQrSheet items={bulkAccess} />
        </div>
      ) : null}
    </section>
  );
}

function AccessCard({ access, compact = false }: { access: GeneratedAccess; compact?: boolean }) {
  return (
    <div className={`grid gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 ${compact ? "" : "md:grid-cols-[auto_1fr]"}`}>
      <div className={`flex items-center justify-center rounded-2xl border border-blue-200 bg-white p-3 ${compact ? "h-40 w-40" : "h-56 w-56"}`}>
        {access.qrDataUrl ? (
          <Image alt="QR สำหรับคนขับ" className="h-full w-full" height={compact ? 160 : 220} src={access.qrDataUrl} unoptimized width={compact ? 160 : 220} />
        ) : (
          <span className="text-sm font-semibold text-blue-900">กำลังสร้าง QR...</span>
        )}
      </div>
      <div className="min-w-0">
        {access.pin ? (
          <div className="mb-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-3">
            <p className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-amber-800">
              <KeyRound className="h-3.5 w-3.5" /> รหัสยืนยัน 6 หลัก
            </p>
            <p className="mt-0.5 text-3xl font-bold tracking-[0.28em] text-amber-900">{access.pin}</p>
            <p className="mt-1 text-[11px] leading-4 text-amber-700">แจ้งรหัสนี้ให้คนขับแยกจาก QR</p>
          </div>
        ) : null}
        <p className="text-xs font-semibold text-blue-950">{access.label}</p>
        <p className="text-xs font-semibold text-blue-900">ลิงก์สำหรับคนขับ</p>
        <a className="mt-2 block break-all text-sm font-semibold text-blue-800 underline" href={access.accessUrl} target="_blank" rel="noreferrer">
          {access.accessUrl}
        </a>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a className="rounded-2xl bg-blue-700 px-4 py-2.5 text-center text-sm font-semibold text-white" href={access.accessUrl} target="_blank" rel="noreferrer">
            เปิดหน้าคนขับ
          </a>
          <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-300 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800" type="button" onClick={() => void navigator.clipboard?.writeText(access.accessUrl)}>
            <Copy className="h-4 w-4" /> คัดลอกลิงก์
          </button>
        </div>
      </div>
    </div>
  );
}

function PrintableQrSheet({ items }: { items: GeneratedAccess[] }) {
  return (
    <div className="qr-print-sheet hidden print:block">
      <h1 className="mb-3 text-xl font-bold text-black">ชุด QR/PIN สำหรับคนขับ</h1>
      <p className="mb-5 text-sm text-black">โปรดส่ง QR และรหัสยืนยันให้คนขับแยกช่องทางกัน</p>
      <div className="grid grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.assignmentId} className="break-inside-avoid rounded-lg border border-black p-3 text-black">
            <p className="text-sm font-bold">{item.label}</p>
            <p className="mt-1 text-xs">Assignment: {item.assignmentId}</p>
            {item.qrDataUrl ? <Image alt="QR สำหรับคนขับ" className="mt-2 h-36 w-36" height={144} src={item.qrDataUrl} unoptimized width={144} /> : null}
            <p className="mt-2 text-xs">PIN: <span className="text-lg font-bold tracking-[0.2em]">{item.pin || "-"}</span></p>
          </div>
        ))}
      </div>
    </div>
  );
}
