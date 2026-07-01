"use client";

import { useState } from "react";
import { assignmentStatusUpdateAction, driverIssueReportAction } from "@/app/actions/driver";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";

export function DriverQuickActions({ driverAccess, mapsUrl = "https://www.google.com/maps" }: { driverAccess?: DriverAccessAssignment; mapsUrl?: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function updateStatus(status: "ready" | "arrived_pickup" | "passenger_onboard" | "completed") {
    if (!driverAccess) {
      setMessage("ไม่พบข้อมูลงาน กรุณาขอ QR ใหม่จากผู้ประสานงาน");
      return;
    }

    setPending(status);
    const result = await assignmentStatusUpdateAction({
      projectId: driverAccess.project.id,
      assignmentId: driverAccess.assignment.id,
      driverId: driverAccess.driver.id,
      status,
      source: "driver_qr"
    });
    setPending(null);

    const statusText: Record<typeof status, string> = {
      ready: "พร้อมเริ่มงาน",
      arrived_pickup: "ถึงจุดรับแล้ว",
      passenger_onboard: "รับผู้โดยสารแล้ว",
      completed: "เสร็จสิ้นงาน"
    };
    setMessage(result.success ? `อัปเดตสถานะแล้ว: ${statusText[status]}` : result.error || "อัปเดตสถานะไม่สำเร็จ");
  }

  async function reportIssue() {
    if (!driverAccess) {
      setMessage("ไม่พบข้อมูลงาน กรุณาขอ QR ใหม่จากผู้ประสานงาน");
      return;
    }

    setPending("issue");
    const result = await driverIssueReportAction({
      projectId: driverAccess.project.id,
      assignmentId: driverAccess.assignment.id,
      driverId: driverAccess.driver.id,
      issueType: "driver_report",
      severity: "warning",
      message: "คนขับแจ้งปัญหาจากหน้าคนขับ"
    });
    setPending(null);
    setMessage(result.success ? "ส่งเรื่องให้ศูนย์ควบคุมแล้ว" : result.error || "แจ้งปัญหาไม่สำเร็จ");
  }

  return (
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div>
        <h2 className="text-lg font-semibold text-ink">อัปเดตสถานะงาน</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">กดสถานะให้ตรงกับความคืบหน้าจริง ระบบจะส่งให้ศูนย์ควบคุมทันที</p>
      </div>

      <div className="grid gap-3">
        <button className="min-h-14 rounded-2xl bg-operation px-4 py-3 text-base font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={Boolean(pending)} onClick={() => updateStatus("ready")} type="button">
          พร้อมเริ่มงาน
        </button>
        <div className="grid gap-3 sm:grid-cols-3">
          <button className="min-h-14 rounded-2xl border border-operation bg-white px-4 py-3 text-base font-semibold text-operation disabled:text-slate-400" disabled={Boolean(pending)} onClick={() => updateStatus("arrived_pickup")} type="button">
            ถึงจุดรับแล้ว
          </button>
          <button className="min-h-14 rounded-2xl border border-operation bg-white px-4 py-3 text-base font-semibold text-operation disabled:text-slate-400" disabled={Boolean(pending)} onClick={() => updateStatus("passenger_onboard")} type="button">
            รับผู้โดยสารแล้ว
          </button>
          <button className="min-h-14 rounded-2xl border border-operation bg-white px-4 py-3 text-base font-semibold text-operation disabled:text-slate-400" disabled={Boolean(pending)} onClick={() => updateStatus("completed")} type="button">
            เสร็จสิ้นงาน
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <a className="min-h-12 rounded-2xl border border-route px-4 py-3 text-center text-sm font-semibold text-route" href={mapsUrl}>
          เปิด Google Maps
        </a>
        <button className="min-h-12 rounded-2xl border border-amber-300 px-4 py-3 text-sm font-semibold text-amber-800 disabled:text-slate-400" disabled={Boolean(pending)} onClick={reportIssue} type="button">
          แจ้งปัญหา
        </button>
      </div>
      {message ? <p className="rounded-2xl bg-slate-50 p-3 text-sm font-medium text-slate-700">{message}</p> : null}
    </section>
  );
}
