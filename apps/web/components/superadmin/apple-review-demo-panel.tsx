"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Copy, QrCode, RefreshCw } from "lucide-react";
import { createAppleReviewDemoAction, type AppleReviewDemoStatus } from "@/app/actions/apple-review-demo";
import { ActionFeedback } from "@/components/ui/action-feedback";

interface Issued {
  accessUrl: string;
  pin: string;
  projectCode: string;
  callSign: string;
}

export function AppleReviewDemoPanel({ status }: { status: AppleReviewDemoStatus }) {
  const router = useRouter();
  const [issued, setIssued] = useState<Issued | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("success");
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function create() {
    setMessage(null);
    startTransition(async () => {
      const result = await createAppleReviewDemoAction();
      if (!result.success) {
        setTone("danger");
        setMessage(result.error || "สร้างงานสาธิตไม่สำเร็จ");
        return;
      }
      setIssued(result.data as Issued);
      setConfirming(false);
      setTone("success");
      setMessage("สร้างงานสาธิตแล้ว — คัดลอกลิงก์กับ PIN ไปวางใน App Store Connect ทันที");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <section className="enterprise-panel grid gap-3 p-4">
        <h2 className="text-lg font-semibold text-ink">สถานะปัจจุบัน</h2>
        {status.exists ? (
          <div className="grid gap-1.5 text-sm">
            <p className="flex items-center gap-2 font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> มีงานสาธิตอยู่ — {status.projectCode}
            </p>
            <p className="text-ink-soft">หน่วยรถ {status.callSign ?? "—"}</p>
            <p className="text-ink-soft">
              วันหมดอายุ QR:{" "}
              <span className="font-semibold text-ink">
                {status.expiresAt ? new Date(status.expiresAt).toLocaleString("th-TH") : "ไม่มีวันหมดอายุ"}
              </span>
            </p>
            <p className={status.activated ? "text-emerald-800" : "text-rose-700"}>
              {status.activated
                ? "ปลดด่านตรวจก่อนเริ่มงานแล้ว ผู้ตรวจจะเข้าหน้างานได้ทันที"
                : "ยังไม่ได้ปลดด่านตรวจ — ผู้ตรวจจะติดหน้าให้ถ่ายรูปรถก่อนถึงหน้างาน"}
            </p>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4" /> ยังไม่มีงานสาธิต — ห้ามส่ง build เข้าตรวจจนกว่าจะสร้างและส่งลิงก์ใหม่ให้ Apple
          </p>
        )}
      </section>

      <section className="enterprise-panel grid gap-3 p-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">สร้างงานสาธิตใหม่</h2>
          <p className="mt-1 text-sm leading-6 text-ink-soft">
            สร้างโครงการ หน่วยรถ คนขับ รถ งาน และ QR ที่ไม่มีวันหมดอายุ พร้อมปลดด่านตรวจให้เรียบร้อย
            งานสาธิตเดิม (ถ้ามี) จะถูกลบก่อน เพื่อให้มีลิงก์เดียวที่ใช้ได้เสมอ
          </p>
        </div>

        {message ? <ActionFeedback tone={tone} message={message} /> : null}

        <div className="flex flex-wrap items-center gap-2">
          {confirming ? (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={create}
                className="inline-flex h-11 items-center gap-2 rounded-command bg-rose-600 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                {isPending ? "กำลังสร้าง…" : "ยืนยัน — ลิงก์เดิมจะใช้ไม่ได้ทันที"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="inline-flex h-11 items-center rounded-command border border-slate-300 bg-white px-4 text-sm font-semibold text-ink-soft"
              >
                ยกเลิก
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => (status.exists ? setConfirming(true) : create())}
              className="inline-flex h-11 items-center gap-2 rounded-command bg-operation px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              <QrCode className="h-4 w-4" />
              {status.exists ? "สร้างใหม่แทนของเดิม" : "สร้างงานสาธิต"}
            </button>
          )}
        </div>
      </section>

      {issued ? (
        <section className="enterprise-panel grid gap-3 border-2 border-amber-400 bg-amber-50/50 p-4">
          <p className="text-sm font-bold text-amber-900">
            คัดลอกไปวางใน App Store Connect → App Review Information → Notes เดี๋ยวนี้ — PIN แสดงครั้งเดียว
          </p>
          <Field label="ลิงก์สำหรับผู้ตรวจ" value={issued.accessUrl} />
          <Field label="PIN" value={issued.pin} big />
          <p className="text-[12px] leading-5 text-amber-900">
            ห้ามเปิดลิงก์นี้เอง — QR ผูกกับเครื่องแรกที่เปิด ถ้าคุณเปิดก่อน ผู้ตรวจจะใช้ไม่ได้
            และต้องกลับมาสร้างใหม่
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="grid gap-1">
      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900">{label}</p>
      <div className="flex items-center gap-2">
        <p className={`min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 ${big ? "text-2xl font-bold tracking-[0.3em] text-ink" : "text-[12px] text-ink-soft"}`}>
          {value}
        </p>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(value)}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-command border border-amber-400 bg-white px-3 text-[12px] font-semibold text-amber-900"
        >
          <Copy className="h-3.5 w-3.5" /> คัดลอก
        </button>
      </div>
    </div>
  );
}
