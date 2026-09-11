"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { checkPilotInfrastructureAction, createProductionPilotSmokeScenarioAction } from "@/app/actions/pilot-smoke-test";
import { withTimeout } from "@/lib/async/timeout";

interface LiveGpsResult {
  projectId: string;
  assignmentId: string;
  callSignId?: string;
  driverId?: string;
  accessUrl: string;
  pin?: string;
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
      try {
        setMessage("กำลังตรวจ Supabase และตารางสำคัญ...");
        const check = await withTimeout(checkPilotInfrastructureAction(), 12000, "ตรวจระบบ", "ตรวจระบบใช้เวลานานเกินกำหนด");
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
        const response = await withTimeout(createProductionPilotSmokeScenarioAction(), 20000, "สร้างชุดทดสอบ", "สร้างชุดทดสอบใช้เวลานานเกินกำหนด");
        if (!response.success) {
          setMessage(response.error || "สร้างชุดทดสอบไม่สำเร็จ");
          setCurrentStep(2);
          return;
        }

        setResult(response.data as LiveGpsResult);
        setCurrentStep(3);
        setMessage("สร้างชุดทดสอบสำเร็จ เปิด QR บนมือถือแล้วกดเริ่มแชร์ GPS");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "ระบบตอบกลับช้าเกินไป กรุณาตรวจ Supabase และลองใหม่");
      }
    });
  }

  return (
    <section className="grid gap-5">
      <div className="enterprise-panel overflow-hidden">
        <div className="command-panel-dark grid gap-5 p-5 text-white sm:p-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,320px)]">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-200">เส้นทางหลักสำหรับทดสอบระบบ</p>
            <h2 className="display-title mt-3 max-w-lg text-white">ทดสอบ QR คนขับและ GPS สดให้จบในหน้าเดียว</h2>
            <p className="mt-3 max-w-md text-[13px] leading-7 text-slate-300 sm:text-sm">
              ตรวจ Supabase สร้างข้อมูลทดสอบจริง สร้าง QR สำหรับคนขับ และพาไป Mission Control เพื่อดูตำแหน่งที่แชร์เข้ามา
            </p>
          </div>
          <div className="rounded-panel border border-white/10 bg-white/[0.06] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">สิ่งที่จะถูกสร้าง</p>
            <ul className="mt-3 grid gap-2 text-[13px] text-slate-100">
              {["โครงการทดสอบ", "ภารกิจ + Call Sign", "คนขับ + รถ + Assignment", "QR/token + assignment packet", "พร้อมรับ GPS จากมือถือคนขับ"].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-300" />
                  <span className="min-w-0">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid gap-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StepItem active={currentStep === 1} done={currentStep > 1} title="ตรวจระบบ" detail="ตรวจ Supabase และตารางสำคัญก่อนสร้างข้อมูล" />
            <StepItem active={currentStep === 2} done={currentStep > 2} title="สร้างชุดทดสอบ" detail="สร้างโครงการ ภารกิจ Assignment และ QR จริง" />
            <StepItem active={currentStep === 3} done={Boolean(result)} title="เปิดหน้าคนขับ" detail="เปิด QR บนมือถือแล้วเริ่มแชร์ GPS" />
            <StepItem active={currentStep === 4} done={false} title="ดูศูนย์ควบคุม" detail="ตรวจหมุด สถานะ และเวลาอัปเดตใน Mission Control" />
          </div>

          <button
            data-testid="live-gps-start"
            className="min-h-12 rounded-panel bg-operation px-6 text-[15px] font-semibold text-white shadow-sm transition hover:bg-operation-deep disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isPending}
            type="button"
            onClick={createScenario}
          >
            {isPending ? "กำลังดำเนินการ..." : "เริ่มทดสอบระบบ"}
          </button>

          {message ? (
            <p
              className={`rounded-panel p-4 text-sm font-medium ${result ? "bg-operation-soft text-operation-deep" : "bg-route-soft text-route"}`}
              data-testid="live-gps-message"
            >
              {message}
            </p>
          ) : null}

          {checkResult ? (
            <div className="rounded-panel border border-border/80 bg-canvas/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-ink">ผลตรวจระบบ</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${checkResult.ready ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                  {checkResult.ready ? "พร้อม" : "ไม่พร้อม"}
                </span>
              </div>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {checkResult.tables.map((table) => (
                  <div key={table.table} className="flex items-center justify-between gap-3 rounded-card bg-white px-3 py-1.5 text-xs">
                    <span className="font-semibold text-ink-soft">{table.table}</span>
                    <span className={table.ok ? "text-emerald-700" : "text-red-700"}>{table.ok ? "ผ่าน" : "ไม่ผ่าน"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {result ? (
        <section className="enterprise-panel grid gap-4 p-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
          <div className="flex h-60 w-full items-center justify-center rounded-panel border border-border bg-white p-4 shadow-sm sm:w-60">
            {qrDataUrl ? <Image alt="QR สำหรับคนขับ" className="h-full w-full" data-testid="live-gps-qr" height={240} src={qrDataUrl} unoptimized width={240} /> : <span className="text-sm font-semibold text-operation">กำลังสร้าง QR...</span>}
          </div>
          <div className="grid min-w-0 content-start gap-4">
            <div>
              <p className="section-label">QR สำหรับคนขับ</p>
              <h3 className="section-title mt-1">เปิดลิงก์นี้บนมือถือคนขับ</h3>
              <p className="section-description mt-1.5">หลังเปิดแล้วให้กด “เริ่มแชร์ตำแหน่ง” และอนุญาต GPS ใน browser จากนั้นกลับมาดู Mission Control</p>
            </div>
            <a
              className="break-all rounded-panel border border-route/30 bg-route-soft p-3 text-sm font-semibold text-route"
              data-testid="live-gps-driver-url"
              href={result.accessUrl}
              target="_blank"
              rel="noreferrer"
            >
              {result.accessUrl}
            </a>
            {result.pin ? (
              <div className="rounded-panel border-2 border-amber-400 bg-amber-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">รหัสยืนยัน 6 หลัก · ต้องกรอกหลังเปิดลิงก์</p>
                <p className="mt-0.5 text-3xl font-bold tracking-[0.3em] text-amber-900">{result.pin}</p>
              </div>
            ) : null}
            <div className="grid gap-2.5 sm:grid-cols-3">
              <a className="rounded-panel bg-route px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:opacity-90" href={result.accessUrl} target="_blank" rel="noreferrer">
                เปิดหน้าคนขับ
              </a>
              <a className="rounded-panel bg-operation px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-operation-deep" href={result.missionControlUrl}>
                เปิดศูนย์ควบคุม
              </a>
              <a className="rounded-panel border border-border bg-white px-4 py-2.5 text-center text-sm font-semibold text-ink-soft transition hover:border-operation/40" href={result.assignmentsUrl}>
                ดู Assignment
              </a>
            </div>
            <div className="grid gap-1 rounded-panel bg-canvas/60 p-4 text-xs leading-6 text-ink-faint">
              <p>Project ID: {result.projectId}</p>
              {result.callSignId ? <p>Call Sign ID: {result.callSignId}</p> : null}
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
    <div
      className={`grid content-start gap-2 rounded-panel border p-4 transition ${
        active ? "border-operation bg-operation-soft" : done ? "border-emerald-200 bg-emerald-50" : "border-border/80 bg-canvas/60"
      }`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${done ? "bg-emerald-500" : active ? "bg-operation" : "bg-slate-300"}`} />
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="text-xs leading-5 text-ink-faint">{detail}</p>
    </div>
  );
}
