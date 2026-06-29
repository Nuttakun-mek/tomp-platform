"use client";

import { useState } from "react";
import type { Assignment } from "@tomp/types/domain";
import { createDriverAccessTokenAction } from "@/app/actions/driver-access";

export function DriverAccessGenerator({ assignments, projectId }: { assignments: Assignment[]; projectId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [accessUrl, setAccessUrl] = useState<string | null>(null);

  async function createAccess(formData: FormData) {
    setMessage("กำลังสร้างลิงก์สำหรับคนขับ");
    setAccessUrl(null);
    const assignmentId = String(formData.get("assignmentId") || "");
    const assignment = assignments.find((item) => item.id === assignmentId);
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
    setMessage("สร้างลิงก์ QR สำหรับคนขับสำเร็จ ใช้ลิงก์นี้ส่งให้คนขับเท่านั้น");
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">สร้างลิงก์ QR สำหรับคนขับ</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        เลือก Assignment จริงเพื่อสร้าง token แบบ assignment-scoped ระบบจะไม่เก็บ raw token ในฐานข้อมูล
      </p>

      {assignments.length ? (
        <form action={createAccess} className="mt-4 grid gap-3">
          <select className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" name="assignmentId" required>
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.id} | {assignment.status}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="submit">
            สร้างลิงก์สำหรับคนขับ
          </button>
        </form>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          ยังไม่มี Assignment ให้สร้าง Assignment ก่อน
        </p>
      )}

      {message ? <p className="mt-4 text-sm font-medium text-slate-700">{message}</p> : null}
      {accessUrl ? (
        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-semibold text-blue-900">ลิงก์สำหรับคนขับ</p>
          <a className="mt-2 block break-all text-sm font-semibold text-blue-800 underline" href={accessUrl}>
            {accessUrl}
          </a>
        </div>
      ) : null}
    </section>
  );
}
