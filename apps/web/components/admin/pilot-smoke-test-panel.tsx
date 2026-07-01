"use client";

import { useState, useTransition } from "react";
import { checkPilotInfrastructureAction, createProductionPilotSmokeScenarioAction } from "@/app/actions/pilot-smoke-test";

interface CheckResult {
  mode: string;
  checkedAt: string;
  ready: boolean;
  tables: Array<{ table: string; ok: boolean; message: string }>;
}

interface ScenarioResult {
  projectId: string;
  assignmentId: string;
  driverId: string;
  accessUrl: string;
  missionControlUrl: string;
  assignmentsUrl: string;
  packetId: string;
  tokenId: string;
}

export function PilotSmokeTestPanel() {
  const [isPending, startTransition] = useTransition();
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function runCheck() {
    setMessage(null);
    startTransition(async () => {
      const result = await checkPilotInfrastructureAction();
      if (!result.success) {
        setMessage(result.error || "ตรวจระบบไม่สำเร็จ");
        return;
      }
      setCheckResult(result.data as CheckResult);
      setMessage("ตรวจระบบเสร็จแล้ว");
    });
  }

  function createScenario() {
    setMessage(null);
    startTransition(async () => {
      const result = await createProductionPilotSmokeScenarioAction();
      if (!result.success) {
        setMessage(result.error || "สร้างชุดทดสอบไม่สำเร็จ");
        return;
      }
      setScenarioResult(result.data as ScenarioResult);
      setMessage("สร้างชุดทดสอบ Production Pilot สำเร็จ");
    });
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-operation">Production Pilot Smoke Test</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">ตรวจแกนระบบก่อนทดสอบจริง</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              ใช้หน้านี้เพื่อตรวจ Supabase, ตาราง driver operations, สร้างชุดทดสอบจริง, เปิด QR คนขับ และตรวจ Mission Control โดยไม่เพิ่ม scope ธุรกิจใหม่
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">Internal Pilot เท่านั้น</span>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-300" disabled={isPending} type="button" onClick={runCheck}>
            ตรวจ Supabase และตาราง
          </button>
          <button className="rounded-xl bg-operation px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-300" disabled={isPending || Boolean(checkResult && !checkResult.ready)} type="button" onClick={createScenario}>
            สร้างชุดทดสอบจริง
          </button>
        </div>

        {message ? <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-900">{message}</p> : null}
      </section>

      {checkResult ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-operation">ผลตรวจ Infrastructure</p>
              <h3 className="mt-1 text-xl font-semibold text-ink">{checkResult.ready ? "พร้อมทดสอบ" : "ยังต้องแก้ migration / grant / RLS"}</h3>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${checkResult.ready ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
              {checkResult.mode}
            </span>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {checkResult.tables.map((row) => (
              <div key={row.table} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{row.table}</p>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                    {row.ok ? "ผ่าน" : "ไม่ผ่าน"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">{row.message}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {scenarioResult ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-soft">
          <p className="text-sm font-semibold text-blue-900">ชุดทดสอบพร้อมใช้งาน</p>
          <h3 className="mt-1 text-xl font-semibold text-ink">เปิด QR บนมือถือ แล้วกลับมาดู Mission Control</h3>
          <div className="mt-4 grid gap-3">
            <a className="break-all rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white" href={scenarioResult.accessUrl} rel="noreferrer" target="_blank">
              เปิดหน้าคนขับ: {scenarioResult.accessUrl}
            </a>
            <div className="grid gap-3 sm:grid-cols-2">
              <a className="rounded-xl border border-blue-300 bg-white px-4 py-3 text-center text-sm font-semibold text-blue-800" href={scenarioResult.missionControlUrl}>
                เปิดศูนย์ควบคุม
              </a>
              <a className="rounded-xl border border-blue-300 bg-white px-4 py-3 text-center text-sm font-semibold text-blue-800" href={scenarioResult.assignmentsUrl}>
                เปิด Assignment
              </a>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-white p-4 text-sm leading-6 text-slate-700">
            <p>Project: {scenarioResult.projectId}</p>
            <p>Assignment: {scenarioResult.assignmentId}</p>
            <p>Driver: {scenarioResult.driverId}</p>
            <p>Packet: {scenarioResult.packetId}</p>
            <p>Token: {scenarioResult.tokenId}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
