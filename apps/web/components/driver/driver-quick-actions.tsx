"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, MapPinned } from "lucide-react";
import { assignmentStatusUpdateAction, driverIssueReportAction } from "@/app/actions/driver";
import { ActionFeedback } from "@/components/ui/action-feedback";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";

const statusText = {
  ready: "พร้อมเริ่มงาน",
  arrived_pickup: "ถึงจุดรับแล้ว",
  passenger_onboard: "รับผู้โดยสารแล้ว",
  completed: "เสร็จสิ้นงาน"
} as const;

export function DriverQuickActions({ driverAccess, mapsUrl = "https://www.google.com/maps" }: { driverAccess?: DriverAccessAssignment; mapsUrl?: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("warning");
  const [pending, setPending] = useState<string | null>(null);
  const [issueMessage, setIssueMessage] = useState("");

  async function updateStatus(status: keyof typeof statusText) {
    if (!driverAccess) {
      setTone("danger");
      setMessage("ไม่พบข้อมูลงาน กรุณาขอ QR ใหม่จากศูนย์ควบคุม");
      return;
    }

    setPending(status);
    setTone("warning");
    setMessage(`กำลังส่งสถานะ: ${statusText[status]}`);
    const result = await assignmentStatusUpdateAction({
      projectId: driverAccess.project.id,
      assignmentId: driverAccess.assignment.id,
      driverId: driverAccess.driver.id,
      status,
      source: "driver_qr"
    });
    setPending(null);
    setTone(result.success ? "success" : "danger");
    setMessage(result.success ? `ส่งสถานะแล้ว: ${statusText[status]}` : result.error || "อัปเดตสถานะไม่สำเร็จ");
  }

  async function reportIssue() {
    if (!driverAccess) {
      setTone("danger");
      setMessage("ไม่พบข้อมูลงาน กรุณาขอ QR ใหม่จากศูนย์ควบคุม");
      return;
    }
    const text = issueMessage.trim();
    if (!text) {
      setTone("warning");
      setMessage("กรุณาพิมพ์รายละเอียดปัญหาก่อนส่ง");
      return;
    }

    setPending("issue");
    setTone("warning");
    setMessage("กำลังส่งข้อความถึงศูนย์ควบคุม");
    const result = await driverIssueReportAction({
      projectId: driverAccess.project.id,
      assignmentId: driverAccess.assignment.id,
      driverId: driverAccess.driver.id,
      issueType: "driver_report",
      severity: "warning",
      message: text
    });
    setPending(null);
    setTone(result.success ? "success" : "danger");
    setMessage(result.success ? "ส่งข้อความถึงศูนย์ควบคุมแล้ว" : result.error || "แจ้งปัญหาไม่สำเร็จ");
    if (result.success) setIssueMessage("");
  }

  return (
    <section className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
      <div>
        <h2 className="text-lg font-semibold text-ink">อัปเดตสถานะงาน</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">กดตามลำดับความคืบหน้าจริง ศูนย์ควบคุมจะเห็นสถานะและ Timeline ทันที</p>
      </div>

      <a className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 py-3 text-base font-semibold text-white shadow-sm" href={mapsUrl}>
        <MapPinned className="h-5 w-5" />
        เปิด Google Maps
      </a>

      <div className="grid gap-3">
        <button className="min-h-14 rounded-2xl bg-operation px-4 py-3 text-base font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={Boolean(pending)} onClick={() => updateStatus("ready")} type="button">
          {pending === "ready" ? "กำลังส่ง..." : "พร้อมเริ่มงาน"}
        </button>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["arrived_pickup", "passenger_onboard", "completed"] as const).map((status) => (
            <button key={status} className="min-h-14 rounded-2xl border border-operation bg-white px-4 py-3 text-base font-semibold text-operation disabled:text-slate-400" disabled={Boolean(pending)} onClick={() => updateStatus(status)} type="button">
              {pending === status ? "กำลังส่ง..." : statusText[status]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          แจ้งศูนย์ควบคุม
        </div>
        <textarea
          className="min-h-24 rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm"
          onChange={(event) => setIssueMessage(event.target.value)}
          placeholder="พิมพ์ข้อความ เช่น รถติดมาก จะถึงช้าประมาณ 10 นาที"
          value={issueMessage}
        />
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-white px-4 py-3 text-sm font-semibold text-amber-800 disabled:text-slate-400" disabled={Boolean(pending)} onClick={reportIssue} type="button">
          <CheckCircle2 className="h-4 w-4" />
          {pending === "issue" ? "กำลังส่ง..." : "ส่งข้อความถึงศูนย์ควบคุม"}
        </button>
      </div>

      <ActionFeedback message={message} tone={tone} />
    </section>
  );
}
