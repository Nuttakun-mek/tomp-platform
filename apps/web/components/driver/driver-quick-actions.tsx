"use client";

import { useState } from "react";
import { assignmentStatusUpdateAction, driverIssueReportAction } from "@/app/actions/driver";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";

export function DriverQuickActions({ driverAccess, mapsUrl = "https://www.google.com/maps" }: { driverAccess?: DriverAccessAssignment; mapsUrl?: string }) {
  const [message, setMessage] = useState<string | null>(null);

  async function updateStatus(status: "ready" | "arrived_pickup" | "passenger_onboard" | "completed") {
    if (!driverAccess) {
      setMessage("ไม่พบข้อมูลงานของคนขับ กรุณาขอ QR ใหม่จากผู้ประสานงาน");
      return;
    }

    const result = await assignmentStatusUpdateAction({
      projectId: driverAccess.project.id,
      assignmentId: driverAccess.assignment.id,
      driverId: driverAccess.driver.id,
      status,
      source: "driver_qr"
    });
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
      setMessage("ไม่พบข้อมูลงานของคนขับ กรุณาขอ QR ใหม่จากผู้ประสานงาน");
      return;
    }

    const result = await driverIssueReportAction({
      projectId: driverAccess.project.id,
      assignmentId: driverAccess.assignment.id,
      driverId: driverAccess.driver.id,
      issueType: "driver_report",
      severity: "warning",
      message: "คนขับแจ้งปัญหาจากหน้าคนขับ"
    });
    setMessage(result.success ? "ส่งเรื่องให้ศูนย์ควบคุมแล้ว" : result.error || "แจ้งปัญหาไม่สำเร็จ");
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <button className="min-h-12 rounded-md bg-operation px-4 py-3 text-sm font-semibold text-white" onClick={() => updateStatus("ready")} type="button">พร้อมเริ่มงาน</button>
        <button className="min-h-12 rounded-md border border-operation px-4 py-3 text-sm font-semibold text-operation" onClick={() => updateStatus("arrived_pickup")} type="button">ถึงจุดรับแล้ว</button>
        <button className="min-h-12 rounded-md border border-operation px-4 py-3 text-sm font-semibold text-operation" onClick={() => updateStatus("passenger_onboard")} type="button">รับผู้โดยสารแล้ว</button>
        <button className="min-h-12 rounded-md border border-operation px-4 py-3 text-sm font-semibold text-operation" onClick={() => updateStatus("completed")} type="button">เสร็จสิ้นงาน</button>
        <a className="min-h-12 rounded-md border border-route px-4 py-3 text-center text-sm font-semibold text-route" href={mapsUrl}>เปิด Google Maps</a>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <button className="min-h-12 rounded-md border border-amber-300 px-4 py-3 text-sm font-semibold text-amber-800" onClick={reportIssue} type="button">แจ้งปัญหา</button>
        <a className="min-h-12 rounded-md border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700" href="tel:+6620000000">โทรหาผู้ประสานงาน</a>
        <a className="min-h-12 rounded-md border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700" href="tel:+6621111111">โทรศูนย์ควบคุม</a>
      </div>
      {message ? <p className="text-sm font-medium text-slate-700">{message}</p> : null}
    </div>
  );
}
