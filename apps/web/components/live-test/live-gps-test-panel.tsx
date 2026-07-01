"use client";

import { useState, useTransition } from "react";
import { createProductionPilotSmokeScenarioAction } from "@/app/actions/pilot-smoke-test";

interface LiveGpsResult {
  projectId: string;
  assignmentId: string;
  accessUrl: string;
  missionControlUrl: string;
  assignmentsUrl: string;
}

export function LiveGpsTestPanel() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<LiveGpsResult | null>(null);

  function createScenario() {
    setMessage(null);
    startTransition(async () => {
      const response = await createProductionPilotSmokeScenarioAction();
      if (!response.success) {
        setMessage(response.error || "สร้างชุดทดสอบไม่สำเร็จ");
        return;
      }
      setResult(response.data as LiveGpsResult);
      setMessage("สร้างชุดทดสอบ GPS สำเร็จ ใช้ลิงก์ด้านล่างทดสอบได้ทันที");
    });
  }

  return (
    <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div>
        <p className="text-sm font-semibold text-operation">ทดสอบระบบจริง</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">สร้างงานทดสอบ GPS สดในคลิกเดียว</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          ระบบจะสร้าง Project, Mission, Call Sign, Driver, Vehicle, Assignment, Assignment Packet และ QR/token ใน Supabase จริง
        </p>
      </div>

      <button className="w-fit rounded-xl bg-operation px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={isPending} type="button" onClick={createScenario}>
        {isPending ? "กำลังสร้างชุดทดสอบ..." : "สร้างชุดทดสอบ GPS สด"}
      </button>

      {message ? <p className={`rounded-xl p-3 text-sm font-medium ${result ? "bg-teal-50 text-teal-900" : "bg-red-50 text-red-900"}`}>{message}</p> : null}

      {result ? (
        <div className="grid gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div>
            <p className="text-xs font-semibold text-blue-900">ลิงก์คนขับ</p>
            <a className="mt-1 block break-all text-sm font-semibold text-blue-800 underline" href={result.accessUrl} target="_blank" rel="noreferrer">
              {result.accessUrl}
            </a>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <a className="rounded-xl bg-blue-700 px-4 py-3 text-center text-sm font-semibold text-white" href={result.accessUrl} target="_blank" rel="noreferrer">
              เปิดหน้าคนขับ
            </a>
            <a className="rounded-xl border border-blue-300 bg-white px-4 py-3 text-center text-sm font-semibold text-blue-800" href={result.missionControlUrl}>
              เปิด Mission Control
            </a>
            <a className="rounded-xl border border-blue-300 bg-white px-4 py-3 text-center text-sm font-semibold text-blue-800 sm:col-span-2" href={result.assignmentsUrl}>
              ดู Assignment และสร้าง QR เพิ่ม
            </a>
          </div>
          <p className="text-xs leading-5 text-blue-900">
            วิธีทดสอบ: เปิดลิงก์คนขับบนมือถือ → กดเริ่มแชร์ GPS → กลับมาดู Mission Control จะเห็นตำแหน่งล่าสุดบนแผนที่
          </p>
        </div>
      ) : null}
    </section>
  );
}
