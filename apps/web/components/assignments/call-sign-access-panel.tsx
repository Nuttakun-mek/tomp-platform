"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { Copy, Eye, KeyRound, Printer, QrCode, RefreshCw } from "lucide-react";
import type { Assignment, CallSign, Driver, Vehicle } from "@tomp/types/domain";
import { createDriverAccessTokenAction } from "@/app/actions/driver-access";
import { createObserverAccessTokenAction } from "@/app/actions/observer-access";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { CallSignCrewForm } from "./call-sign-crew-form";

// Access is issued per crewed unit, not per job: one Call Sign is one driver in
// one vehicle, and that is the thing a QR should name. Issuing per job was what
// filled Mission Control with duplicate cards and stranded job history on old
// tokens — see docs/11-codex/967.

interface Unit {
  callSign: CallSign;
  driver?: Driver;
  vehicle?: Vehicle;
  /** A job on this unit, needed because the token still records one for compatibility. */
  anchorAssignmentId: string | null;
  jobCount: number;
}

interface Issued {
  callSignId: string;
  accessUrl: string;
  pin: string | null;
  qrDataUrl: string | null;
}

async function renderQr(url: string, width = 240) {
  const QRCode = await import("qrcode");
  return QRCode.toDataURL(url, { margin: 2, width, errorCorrectionLevel: "M" });
}

export function CallSignAccessPanel({
  projectId,
  projectCode,
  assignments,
  callSigns,
  drivers,
  vehicles
}: {
  projectId: string;
  projectCode: string;
  assignments: Assignment[];
  callSigns: CallSign[];
  drivers: Driver[];
  vehicles: Vehicle[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("success");
  const [issued, setIssued] = useState<Issued | null>(null);
  const [observerUrl, setObserverUrl] = useState<{ callSignId: string; url: string } | null>(null);
  // Set when the server says a live QR already exists: reissuing kills whatever
  // is already printed, so it takes a second, deliberate press.
  const [confirmReissue, setConfirmReissue] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const units = useMemo<Unit[]>(() => {
    const driverById = new Map(drivers.map((d) => [d.id, d]));
    const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
    const live = assignments.filter((a) => !["cancelled", "archived"].includes(a.status));

    return callSigns
      .filter((cs) => cs.status === "active")
      .map((cs) => {
        const jobs = live.filter((a) => a.callSignId === cs.id);
        // Prefer the job actually running; otherwise any job will do — the token
        // only needs one to point at.
        const anchor = jobs.find((a) => a.status === "active") ?? jobs[0];
        return {
          callSign: cs,
          driver: cs.driverId ? driverById.get(cs.driverId) : undefined,
          vehicle: cs.vehicleId ? vehicleById.get(cs.vehicleId) : undefined,
          anchorAssignmentId: anchor?.id ?? null,
          jobCount: jobs.length
        };
      })
      .sort((a, b) => a.callSign.callSign.localeCompare(b.callSign.callSign, "th"));
  }, [assignments, callSigns, drivers, vehicles]);

  const ready = units.filter((u) => u.driver && u.vehicle && u.anchorAssignmentId);

  function issue(unit: Unit, replaceExisting: boolean) {
    setMessage(null);
    setIssued(null);
    if (!unit.anchorAssignmentId) {
      setTone("warning");
      setMessage("Call Sign นี้ยังไม่มีงาน กรุณาเพิ่มงานให้คันนี้ก่อนออก QR");
      return;
    }

    startTransition(async () => {
      const result = await createDriverAccessTokenAction({
        projectId,
        assignmentId: unit.anchorAssignmentId,
        driverId: unit.callSign.driverId || null,
        replaceExisting
      });

      if (!result.success) {
        // The refusal carries the Call Sign, which is how we know to offer the
        // deliberate reissue rather than just showing an error.
        const blocked = (result.fieldErrors?.callSignId ?? [])[0];
        if (blocked) {
          setConfirmReissue(unit.callSign.id);
          setTone("warning");
          setMessage(result.error || "Call Sign นี้มี QR ที่ใช้งานอยู่แล้ว");
          return;
        }
        setConfirmReissue(null);
        setTone("danger");
        setMessage(result.error || "ออก QR ไม่สำเร็จ");
        return;
      }

      const data = result.data as { accessUrl?: string; pin?: string };
      const accessUrl = data.accessUrl || "";
      setConfirmReissue(null);
      setIssued({
        callSignId: unit.callSign.id,
        accessUrl,
        pin: data.pin || null,
        qrDataUrl: accessUrl ? await renderQr(accessUrl) : null
      });
      setTone("success");
      setMessage(
        replaceExisting
          ? "ออก QR ใบใหม่แล้ว ใบเดิมและรหัสเดิมใช้ไม่ได้อีก กรุณาแจ้งคนขับ"
          : "ออก QR และรหัสสำเร็จ ส่ง QR กับรหัสคนละช่องทาง"
      );
    });
  }

  function issueObserverLink(unit: Unit) {
    setMessage(null);
    startTransition(async () => {
      const result = await createObserverAccessTokenAction({ projectId, callSignId: unit.callSign.id });
      if (!result.success) {
        setTone("danger");
        setMessage(result.error || "สร้างลิงก์ไม่สำเร็จ");
        return;
      }
      const data = result.data as { trackUrl?: string; accessUrl?: string };
      setObserverUrl({ callSignId: unit.callSign.id, url: data.trackUrl || data.accessUrl || "" });
      setTone("success");
      setMessage("สร้างลิงก์แล้ว ส่งให้ผู้โดยสารหรือผู้ติดตามได้ ลิงก์นี้ดูตำแหน่งได้อย่างเดียว แก้ไขงานไม่ได้");
    });
  }

  return (
    <section className="enterprise-panel-soft border-route/20 bg-blue-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-label">ขั้นที่ 1</p>
          <h2 className="text-lg font-semibold text-blue-950">จัดหน่วยรถ และออก QR</h2>
          <p className="mt-1 text-sm leading-6 text-blue-900">
            หนึ่งหน่วย = คนขับหนึ่งคน + รถหนึ่งคัน = QR หนึ่งใบ ใช้ได้ทุกงานของหน่วยนั้นทั้งโครงการ ไม่ต้องออกใหม่รายงาน
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800 shadow-sm">
          {ready.length}/{units.length} หน่วยพร้อมออก QR
        </span>
      </div>

      <div className="mt-3">
        <CallSignCrewForm
          projectId={projectId}
          projectCode={projectCode}
          callSigns={callSigns}
          drivers={drivers}
          vehicles={vehicles}
        />
      </div>

      {message ? (
        <div className="mt-3">
          <ActionFeedback tone={tone} message={message} />
        </div>
      ) : null}

      <div className="mt-3 grid gap-2">
        {units.length === 0 ? (
          <p className="rounded-card bg-white px-3 py-4 text-center text-[13px] text-ink-soft">
            ยังไม่มี Call Sign ในโครงการนี้ สร้าง Call Sign และจับคู่คนขับกับรถก่อน
          </p>
        ) : null}

        {units.map((unit) => {
          const crewed = Boolean(unit.driver && unit.vehicle);
          const showQr = issued?.callSignId === unit.callSign.id;
          const showObserver = observerUrl?.callSignId === unit.callSign.id;
          const needsConfirm = confirmReissue === unit.callSign.id;

          return (
            <article key={unit.callSign.id} className="rounded-card bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-ink">Call Sign {unit.callSign.callSign}</p>
                  <p className="mt-0.5 truncate text-[12px] text-ink-soft">
                    {unit.driver?.fullName ?? "ยังไม่ผูกคนขับ"} / {unit.vehicle?.plateNumber ?? "ยังไม่ผูกรถ"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">{unit.jobCount} งานในโครงการนี้</p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isPending || !crewed || !unit.anchorAssignmentId}
                    onClick={() => issue(unit, needsConfirm)}
                    className={`flex min-h-9 items-center gap-1.5 rounded-command px-3 text-[12px] font-semibold text-white disabled:opacity-40 ${
                      needsConfirm ? "bg-amber-600" : "bg-route"
                    }`}
                  >
                    {needsConfirm ? <RefreshCw className="h-3.5 w-3.5" /> : <QrCode className="h-3.5 w-3.5" />}
                    {needsConfirm ? "ยืนยันออกใบใหม่" : "ออก QR"}
                  </button>
                  <button
                    type="button"
                    disabled={isPending || !crewed}
                    onClick={() => issueObserverLink(unit)}
                    className="flex min-h-9 items-center gap-1.5 rounded-command border border-slate-300 bg-white px-3 text-[12px] font-semibold text-ink-soft disabled:opacity-40"
                  >
                    <Eye className="h-3.5 w-3.5" /> ลิงก์ผู้โดยสาร/ผู้ติดตาม
                  </button>
                </div>
              </div>

              {!crewed ? (
                <p className="mt-2 rounded-card bg-amber-50 px-2.5 py-1.5 text-[12px] font-semibold text-amber-800">
                  ยังออก QR ไม่ได้ — ต้องผูก{!unit.driver ? "คนขับ" : ""}
                  {!unit.driver && !unit.vehicle ? " และ" : ""}
                  {!unit.vehicle ? "รถ" : ""}ให้ Call Sign นี้ก่อน
                </p>
              ) : null}

              {crewed && !unit.anchorAssignmentId ? (
                <p className="mt-2 rounded-card bg-slate-100 px-2.5 py-1.5 text-[12px] text-ink-soft">
                  ยังไม่มีงานสำหรับคันนี้ เพิ่มงานก่อนออก QR
                </p>
              ) : null}

              {showQr ? (
                <div className="mt-3 grid gap-2 border-t border-black/5 pt-3 sm:grid-cols-[auto_1fr]">
                  {issued.qrDataUrl ? (
                    <Image src={issued.qrDataUrl} alt={`QR ${unit.callSign.callSign}`} width={160} height={160} unoptimized />
                  ) : null}
                  <div className="grid content-start gap-2">
                    <div>
                      <p className="text-[11px] font-semibold text-ink-faint">รหัสยืนยัน 6 หลัก</p>
                      <p className="text-2xl font-bold tracking-[0.3em] text-ink">{issued.pin ?? "—"}</p>
                      <p className="mt-1 text-[11px] leading-5 text-ink-soft">
                        ส่งรหัสคนละช่องทางกับ QR รหัสนี้แสดงครั้งเดียว ถ้าปิดหน้านี้แล้วต้องออกใบใหม่
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard?.writeText(issued.accessUrl)}
                        className="flex min-h-9 items-center gap-1.5 rounded-command border border-slate-300 px-3 text-[12px] font-semibold text-ink-soft"
                      >
                        <Copy className="h-3.5 w-3.5" /> คัดลอกลิงก์
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="flex min-h-9 items-center gap-1.5 rounded-command border border-slate-300 px-3 text-[12px] font-semibold text-ink-soft"
                      >
                        <Printer className="h-3.5 w-3.5" /> พิมพ์
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {showObserver ? (
                <div className="mt-2 grid gap-1 rounded-card bg-slate-50 px-2.5 py-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-faint">
                    <KeyRound className="h-3 w-3" /> ลิงก์ผู้โดยสาร/ผู้ติดตาม (ดูอย่างเดียว)
                  </p>
                  <p className="break-all text-[12px] text-ink-soft">{observerUrl.url}</p>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard?.writeText(observerUrl.url)}
                    className="mt-1 flex min-h-8 w-fit items-center gap-1.5 rounded-command border border-slate-300 bg-white px-2.5 text-[12px] font-semibold text-ink-soft"
                  >
                    <Copy className="h-3 w-3" /> คัดลอก
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
