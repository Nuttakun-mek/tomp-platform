"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { checkPilotInfrastructureAction, createProductionPilotSmokeScenarioAction } from "@/app/actions/pilot-smoke-test";

interface LiveGpsResult {
  projectId: string;
  assignmentId: string;
  driverId?: string;
  accessUrl: string;
  missionControlUrl: string;
  assignmentsUrl: string;
  packetId?: string;
  tokenId?: string;
}

interface TableCheck {
  table: string;
  ok: boolean;
  message: string;
}

interface CheckResult {
  ready: boolean;
  mode: string;
  tables: TableCheck[];
}

export function LiveGpsTestPanel() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [result, setResult] = useState<LiveGpsResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function renderQr() {
      if (!result?.accessUrl) {
        setQrDataUrl(null);
        return;
      }
      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(result.accessUrl, { margin: 2, width: 240, errorCorrectionLevel: "M" });
      if (!cancelled) setQrDataUrl(dataUrl);
    }
    void renderQr();
    return () => {
      cancelled = true;
    };
  }, [result?.accessUrl]);

  function createScenario() {
    setMessage(null);
    setResult(null);
    setQrDataUrl(null);
    setCurrentStep(1);
    startTransition(async () => {
      setMessage("กำลังตรวจ Supabase และตารางสำคัญ...");
      const check = await checkPilotInfrastructureAction();
      if (!check.success) {
        setMessage(check.error || "ตรวจระบบไม่สำเร็จ กรุณาตรวจ Supabase และ environment");
        setCurrentStep(1);
        return;
      }

      const infra = check.data as CheckResult;
      setCheckResult(infra);
      if (!infra.ready) {
        setMessage("ยังเริ่มทดสอบไม่ได้ เพราะตารางบางส่วนไม่พร้อม กรุณาดูรายการที่ไม่ผ่านด้านล่าง");
        setCurrentStep(1);
        return;
      }

      setCurrentStep(2);
      setMessage("ระบบพร้อม กำลังสร้างโครงการ ภารกิจ Assignment และ QR จริง...");
      const response = await createProductionPilotSmokeScenarioAction();
      if (!response.success) {
        setMessage(response.error || "สร้างชุดทดสอบไม่สำเร็จ");
        setCurrentStep(2);
        return;
      }
      setResult(response.data as LiveGpsResult);
      setCurrentStep(3);
      setMessage("สร้างชุดทดสอบสำเร็จ เปิด QR บนมือถือแล้วกดเริ่มแชร์ GPS");
    });
  }

  return (
    <section className="grid gap-6">
      <div className="enterprise-panel overflow-hidden">
        <div className="grid gap-6 bg-slate-950 p-6 text-white lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-sm font-semibold text-teal-200">เส้นทางหลักสำหรับทดสอบระบบ</p>
            <h2 className="mt-2 text-2xl font-semibold leading-snug md:text-3xl">ทดสอบ QR คนขับและ GPS สดให้จบในหน้าเดียว</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
              หน้านี้จะตรวจ Supabase สร้างข้อมูลทดสอบจริง สร้าง QR สำหรับคนขับ และพาไป Mission Control เพื่อดูตำแหน่งที่แชร์เข้ามา
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <p className="text-xs font-semibold text-slate-300">สิ่งที่จะถูกสร้าง</p>
            <div className="mt-3 grid gap-2 text-sm text-white">
              <span>โครงการทดสอบ</span>
              <span>ภารกิจ + Call Sign</span>
              <span>คนขับ + รถ + Assignment</span>
              <span>QR/token + assignment packet</span>
              <span>พร้อมรับ GPS จากมือถือคนขับ</span>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-4">
            <StepItem active={currentStep === 1} done={currentStep > 1} title="ตรวจระบบ" detail="ตรวจ Supabase และตารางสำคัญก่อนสร้างข้อมูล" />
            <StepItem active={currentStep === 2} done={currentStep > 2} title="สร้างชุดทดสอบ" detail="สร้างโครงการ ภารกิจ Assignment และ QR จริง" />
            <StepItem active={currentStep === 3} done={Boolean(result)} title="เปิดหน้าคนขับ" detail="เปิด QR บนมือถือแล้วเริ่มแชร์ GPS" />
            <StepItem active={currentStep === 4} done={false} title="ดูศูนย์ควบคุม" detail="ตรวจหมุด สถานะ และเวลาอัปเดตล่าสุดใน Mission Control" />
          </div>

          <div className="grid content-start gap-4">
            <button className="min-h-14 rounded-2xl bg-operation px-5 py-3 text-base font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={isPending} type="button" onClick={createScenario}>
              {isPending ? "กำลังดำเนินการ..." : "เริ่มทดสอบระบบ"}
            </button>

            {message ? <p className={`rounded-2xl p-4 text-sm font-medium ${result ? "bg-teal-50 text-teal-900" : "bg-blue-50 text-blue-900"}`}>{message}</p> : null}

            {checkResult ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-ink">ผลตรวจระบบ</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${checkResult.ready ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                    {checkResult.ready ? "พร้อม" : "ไม่พร้อม"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2">
                  {checkResult.tables.slice(0, 8).map((table) => (
                    <div key={table.table} className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-slate-700">{table.table}</span>
                      <span className={table.ok ? "text-emerald-700" : "text-red-700"}>{table.ok ? "ผ่าน" : table.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {result ? (
        <section className="enterprise-panel grid gap-5 p-5 lg:grid-cols-[auto_1fr]">
          <div className="flex h-64 w-full items-center justify-center rounded-2xl border border-blue-200 bg-white p-4 shadow-soft sm:w-64">
            {qrDataUrl ? <Image alt="QR สำหรับคนขับ" className="h-full w-full" height={240} src={qrDataUrl} unoptimized width={240} /> : <span className="text-sm font-semibold text-blue-900">กำลังสร้าง QR...</span>}
          </div>
          <div className="grid content-start gap-4">
            <div>
              <p className="text-sm font-semibold text-operation">QR สำหรับคนขับ</p>
              <h3 className="mt-1 text-2xl font-semibold text-ink">เปิดลิงก์นี้บนมือถือคนขับ</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">หลังเปิดแล้วให้กด “เริ่มแชร์ตำแหน่ง” และอนุญาต GPS ใน browser จากนั้นกลับมาดู Mission Control</p>
            </div>
            <a className="break-all rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800 underline" href={result.accessUrl} target="_blank" rel="noreferrer">
              {result.accessUrl}
            </a>
            <div className="grid gap-3 sm:grid-cols-3">
              <a className="rounded-2xl bg-blue-700 px-4 py-3 text-center text-sm font-semibold text-white" href={result.accessUrl} target="_blank" rel="noreferrer">
                เปิดหน้าคนขับ
              </a>
              <a className="rounded-2xl bg-operation px-4 py-3 text-center text-sm font-semibold text-white" href={result.missionControlUrl}>
                เปิดศูนย์ควบคุม
              </a>
              <a className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800" href={result.assignmentsUrl}>
                ดู Assignment
              </a>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600">
              <p>Project ID: {result.projectId}</p>
              <p>Assignment ID: {result.assignmentId}</p>
              {result.driverId ? <p>Driver ID: {result.driverId}</p> : null}
              {result.packetId ? <p>Packet ID: {result.packetId}</p> : null}
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}

function StepItem({ active, done, title, detail }: { active: boolean; done: boolean; title: string; detail: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${active ? "border-operation bg-teal-50" : done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-3 w-3 rounded-full ${done ? "bg-emerald-500" : active ? "bg-operation" : "bg-slate-300"}`} />
        <div>
          <p className="font-semibold text-ink">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
        </div>
      </div>
    </div>
  );
}
