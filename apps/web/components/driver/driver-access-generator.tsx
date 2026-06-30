"use client";

import { useState, useTransition } from "react";
import type { Assignment } from "@tomp/types/domain";
import { createDriverAccessTokenAction } from "@/app/actions/driver-access";

export function DriverAccessGenerator({ assignments, projectId }: { assignments: Assignment[]; projectId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [accessUrl, setAccessUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">สร้างลิงก์ QR สำหรับคนขับ</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        เลือก Assignment จริงเพื่อสร้าง token สำหรับคนขับ ระบบจะผูกลิงก์กับ Assignment นี้เท่านั้น
      </p>

      {assignments.length ? (
        <form action={createAccess} className="mt-4 grid gap-3">
          <select className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" name="assignmentId" required>
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.id.slice(0, 8)} | {assignment.status} | {assignment.driverId ? "มีคนขับ" : "ยังไม่มีคนขับ"}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300" disabled={isPending} type="submit">
            {isPending ? "กำลังสร้าง..." : "สร้างลิงก์สำหรับคนขับ"}
          </button>
        </form>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          ยังไม่มี Assignment ให้สร้าง QR กรุณาสร้าง Assignment ก่อน หรือใช้หน้า “ทดสอบ GPS สด”
        </p>
      )}

      {message ? <p className="mt-4 text-sm font-medium text-slate-700">{message}</p> : null}
      {accessUrl ? (
        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-semibold text-blue-900">ลิงก์สำหรับคนขับ</p>
          <a className="mt-2 block break-all text-sm font-semibold text-blue-800 underline" href={accessUrl} target="_blank" rel="noreferrer">
            {accessUrl}
          </a>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <a className="rounded-md bg-blue-700 px-4 py-2 text-center text-sm font-semibold text-white" href={accessUrl} target="_blank" rel="noreferrer">
              เปิดหน้าคนขับ
            </a>
            <button className="rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-800" type="button" onClick={() => void navigator.clipboard?.writeText(accessUrl)}>
              คัดลอกลิงก์
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
