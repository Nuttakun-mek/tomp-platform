"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, ChevronDown, MapPin, MessageSquare, Navigation, Phone, TriangleAlert } from "lucide-react";
import {
  assignmentStatusUpdateAction,
  driverCheckinAction,
  driverIssueReportAction,
  recordVehicleEvidenceAction
} from "@/app/actions/driver";
import { DriverChatThread } from "@/components/driver/driver-chat-thread";
import { DriverLocationShare } from "@/components/driver/driver-location-share";
import { DriverPhotoCheck } from "@/components/driver/driver-photo-check";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";
import type { DriverIssueMessage } from "@/lib/data/driver-operations";
import type { DriverNotification } from "@tomp/types/domain";
import { formatStatusTh } from "@/lib/i18n/status-th";
import { buildGoogleMapsDirectionsUrl } from "@tomp/driver-core";

type Phase = "assigned" | "ready" | "sharing";

const TRIP_STEPS: Array<{ status: "arrived_pickup" | "passenger_onboard" | "completed"; label: string }> = [
  { status: "arrived_pickup", label: "ถึงจุดรับแล้ว" },
  { status: "passenger_onboard", label: "รับผู้โดยสารแล้ว" },
  { status: "completed", label: "ส่งเสร็จแล้ว" }
];

const ISSUE_TYPES: Array<{ type: string; label: string }> = [
  { type: "delay", label: "รถติด / มาช้า" },
  { type: "vehicle", label: "รถมีปัญหา" },
  { type: "passenger", label: "ติดต่อผู้โดยสารไม่ได้" },
  { type: "route", label: "เส้นทางมีปัญหา" },
  { type: "safety", label: "ความปลอดภัย" },
  { type: "other", label: "อื่น ๆ" }
];

function metaText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function DriverTaskView({ driverAccess }: { driverAccess: DriverAccessAssignment }) {
  const meta = driverAccess.assignment.metadata;
  const pickup = metaText(meta.pickupLocation || meta.pickup_location, "ยังไม่ระบุจุดรับ");
  const dropoff = metaText(meta.dropoffLocation || meta.dropoff_location, "ยังไม่ระบุจุดส่ง");
  const commitmentTime = metaText(meta.commitmentTime || meta.commitment_time, "ยังไม่ระบุเวลา");
  const mapsUrl = buildGoogleMapsDirectionsUrl(dropoff, pickup);
  const coordinatorPhone = metaText(
    driverAccess.packet?.contactInstruction?.coordinatorPhone || meta.coordinatorPhone || meta.coordinator_phone,
    ""
  );

  const [phase, setPhase] = useState<Phase>("assigned");
  const [tripStep, setTripStep] = useState(0);
  const [banner, setBanner] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [issueOpen, setIssueOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(true);
  const [nextStepsOpen, setNextStepsOpen] = useState(false);
  const [notifications, setNotifications] = useState<DriverNotification[]>(driverAccess.notifications);
  const [messages, setMessages] = useState<DriverIssueMessage[]>(driverAccess.messages);
  const [gpsLight, setGpsLight] = useState<"off" | "live" | "stale">("off");
  const [checkOpen, setCheckOpen] = useState(false);
  const [checks, setChecks] = useState({ name: false, phone: false, vehicle: false, gps: false });
  const [photoPaths, setPhotoPaths] = useState<{ vehicle?: string; plate?: string }>({});
  const allChecked = checks.name && checks.phone && checks.vehicle && checks.gps;
  const photosReady = Boolean(photoPaths.vehicle && photoPaths.plate);

  const ids = {
    projectId: driverAccess.project.id,
    assignmentId: driverAccess.assignment.id,
    driverId: driverAccess.driver.id
  };

  // poll the control centre for messages + route changes every 15s
  const seenIds = useRef(new Set(driverAccess.notifications.map((n) => n.id)));
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch(`/api/driver/updates?token=${encodeURIComponent(driverAccess.token)}`, { cache: "no-store" });
        const json = (await res.json()) as {
          success?: boolean;
          data?: { notifications?: DriverNotification[]; messages?: DriverIssueMessage[] };
        };
        if (!alive || !json.success || !json.data) return;
        if (Array.isArray(json.data.messages)) setMessages(json.data.messages);
        if (Array.isArray(json.data.notifications)) {
          setNotifications(json.data.notifications);
          for (const n of json.data.notifications) {
            if (!seenIds.current.has(n.id)) {
              seenIds.current.add(n.id);
              setBanner({ tone: "ok", text: `ข้อความจากศูนย์: ${n.title || n.body}` });
            }
          }
        }
      } catch {
        /* keep last known */
      }
    }
    const timer = window.setInterval(poll, 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [driverAccess.token]);

  function markReady() {
    if (!photosReady) {
      setBanner({ tone: "error", text: "กรุณาถ่ายรูปรถและป้ายทะเบียนก่อนกดพร้อมรับงาน" });
      return;
    }
    setBanner(null);
    startTransition(async () => {
      const result = await driverCheckinAction({
        ...ids,
        status: "ready",
        confirmedName: checks.name || allChecked,
        confirmedPhone: checks.phone || allChecked,
        confirmedVehicle: checks.vehicle || allChecked,
        gpsConsent: checks.gps || allChecked,
        metadata: { via: "driver_task_view", checklistComplete: allChecked, photoPaths }
      });
      if (!result.success) {
        setBanner({ tone: "error", text: result.error || "บันทึกไม่สำเร็จ ลองอีกครั้ง" });
        return;
      }
      await recordVehicleEvidenceAction({ token: driverAccess.token, vehiclePath: photoPaths.vehicle, platePath: photoPaths.plate }).catch(() => undefined);
      setPhase("ready");
      setBanner({ tone: "ok", text: "แจ้งความพร้อมแล้ว ศูนย์ควบคุมได้รับข้อมูลและรูปแล้ว" });
    });
  }

  function advanceTrip(status: (typeof TRIP_STEPS)[number]["status"], nextIndex: number) {
    setBanner(null);
    startTransition(async () => {
      const result = await assignmentStatusUpdateAction({ ...ids, status, source: "driver_qr", metadata: {} });
      if (result.success) {
        setTripStep(nextIndex);
        setBanner({ tone: "ok", text: "อัปเดตสถานะให้ศูนย์ควบคุมแล้ว" });
      } else {
        setBanner({ tone: "error", text: result.error || "อัปเดตไม่สำเร็จ" });
      }
    });
  }

  function reportIssue(type: string) {
    setBanner(null);
    startTransition(async () => {
      const result = await driverIssueReportAction({
        ...ids,
        issueType: type,
        severity: type === "safety" ? "critical" : "warning",
        message: ISSUE_TYPES.find((i) => i.type === type)?.label ?? type,
        metadata: { via: "driver_task_view" }
      });
      setIssueOpen(false);
      setBanner(
        result.success
          ? { tone: "ok", text: "แจ้งปัญหาแล้ว ศูนย์ควบคุมจะติดต่อกลับ" }
          : { tone: "error", text: result.error || "แจ้งปัญหาไม่สำเร็จ" }
      );
    });
  }

  function sendMessage(text: string) {
    const value = text.trim();
    if (!value) return;
    const optimistic: DriverIssueMessage = {
      id: `local-${Date.now()}`,
      text: value,
      at: new Date().toISOString(),
      issueType: "message",
      severity: "info"
    };
    setMessages((current) => [...current, optimistic]);
    startTransition(async () => {
      const result = await driverIssueReportAction({
        ...ids,
        issueType: "message",
        severity: "info",
        message: value,
        metadata: { via: "driver_task_view", kind: "driver_message" }
      });
      if (!result.success) {
        setMessages((current) => current.filter((m) => m.id !== optimistic.id));
        setBanner({ tone: "error", text: result.error || "ส่งข้อความไม่สำเร็จ" });
      }
    });
  }

  const gpsDot = gpsLight === "live" ? "bg-emerald-500" : gpsLight === "stale" ? "bg-amber-500" : "bg-slate-300";
  const gpsLabel = gpsLight === "live" ? "GPS สด" : gpsLight === "stale" ? "GPS ช้า" : "ยังไม่แชร์ GPS";
  const currentStep = TRIP_STEPS[tripStep];
  const doneSteps = TRIP_STEPS.slice(0, tripStep);
  const laterSteps = TRIP_STEPS.slice(tripStep + 1);

  return (
    <div className="grid gap-3 pb-6">
      {/* header */}
      <header className="grid gap-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-operation">{driverAccess.project.projectName}</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
            <span className={`h-2 w-2 rounded-full ${gpsDot}`} />
            {gpsLabel}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-ink">Call Sign {driverAccess.callSign.callSign}</h1>
          <span className="rounded-full bg-operation-soft px-2.5 py-1 text-[11px] font-semibold text-operation">
            {formatStatusTh(driverAccess.assignment.status)}
          </span>
        </div>
      </header>

      {/* identity — driver / vehicle / plate, at the top, collapsible */}
      <section className="rounded-card border border-border bg-white">
        <button
          type="button"
          onClick={() => setIdentityOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        >
          <span className="min-w-0 text-[13px]">
            <span className="font-semibold text-ink">{driverAccess.driver.fullName}</span>
            <span className="text-ink-faint"> · {driverAccess.vehicle.plateNumber}</span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-ink-faint transition ${identityOpen ? "rotate-180" : ""}`} />
        </button>
        {identityOpen ? (
          <div className="grid gap-1 border-t border-border px-3 py-2.5 text-[13px] text-ink-soft">
            <p><span className="font-semibold text-ink">คนขับ</span> · {driverAccess.driver.fullName} · {driverAccess.driver.phone || "ไม่มีเบอร์"}</p>
            <p><span className="font-semibold text-ink">รถ</span> · {driverAccess.vehicle.plateNumber} · {driverAccess.vehicle.vehicleType} · {driverAccess.vehicle.capacity || 0} ที่นั่ง</p>
          </div>
        ) : null}
      </section>

      {banner ? (
        <p className={`rounded-card px-3 py-2 text-[13px] font-semibold ${banner.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
          {banner.text}
        </p>
      ) : null}

      {/* route */}
      <section className="smart-card grid gap-2.5">
        <div className="grid gap-2">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-operation" />
            <span className="text-[13px]"><span className="font-semibold text-ink">จุดรับ</span> · {pickup}</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <span className="text-[13px]"><span className="font-semibold text-ink">จุดส่ง</span> · {dropoff}</span>
          </div>
          <p className="text-[12px] text-ink-faint">เวลานัด {commitmentTime}</p>
        </div>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-12 items-center justify-center gap-2 rounded-command bg-route px-4 text-[15px] font-semibold text-white"
        >
          <Navigation className="h-4 w-4" /> เปิด Google Maps
        </a>
      </section>

      {/* primary action */}
      <section className="smart-card grid gap-3">
        {phase === "assigned" ? (
          <>
            <DriverPhotoCheck token={driverAccess.token} onChange={setPhotoPaths} />

            <button
              type="button"
              onClick={() => setCheckOpen((v) => !v)}
              className={`flex items-center justify-between rounded-card border px-3 py-2 text-[13px] font-semibold ${
                allChecked ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-border bg-white text-ink-soft"
              }`}
            >
              {allChecked ? "ตรวจก่อนรับงาน ครบแล้ว" : `ตรวจก่อนรับงาน (${Object.values(checks).filter(Boolean).length}/4)`}
              <ChevronDown className={`h-4 w-4 transition ${checkOpen ? "rotate-180" : ""}`} />
            </button>
            {checkOpen ? (
              <div className="grid gap-1.5">
                {(
                  [
                    ["name", "ยืนยันชื่อคนขับถูกต้อง"],
                    ["phone", "ยืนยันเบอร์โทรถูกต้อง"],
                    ["vehicle", "ยืนยันรถที่ได้รับมอบหมาย"],
                    ["gps", "ยินยอมเปิด GPS ระหว่างปฏิบัติงาน"]
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2.5 rounded-card border border-border bg-white px-3 py-2 text-[13px]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-teal-700"
                      checked={checks[key]}
                      onChange={(e) => setChecks((c) => ({ ...c, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={markReady}
              disabled={isPending || !photosReady}
              className="flex min-h-14 items-center justify-center gap-2 rounded-command bg-operation px-4 text-[16px] font-bold text-white disabled:opacity-60"
            >
              <CheckCircle2 className="h-5 w-5" />
              {isPending ? "กำลังบันทึก..." : !photosReady ? "ถ่ายรูปให้ครบก่อน" : "พร้อมรับงาน"}
            </button>
          </>
        ) : null}

        {phase === "ready" ? (
          <>
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> แจ้งความพร้อมแล้ว
            </p>
            <button
              type="button"
              onClick={() => {
                setPhase("sharing");
                setGpsLight("live");
              }}
              className="flex min-h-14 items-center justify-center gap-2 rounded-command bg-route px-4 text-[16px] font-bold text-white"
            >
              <Navigation className="h-5 w-5" /> เริ่มแชร์ตำแหน่ง GPS
            </button>
          </>
        ) : null}

        {phase === "sharing" ? (
          <div className="grid gap-3">
            <a
              href={`tompdriver://?token=${encodeURIComponent(driverAccess.token)}`}
              className="rounded-card border border-operation/30 bg-operation-soft px-3 py-2 text-center text-[12px] font-semibold text-operation"
            >
              เปิดในแอป TOMP Driver — แชร์ GPS ต่อเนื่องแม้ปิดจอ
            </a>
            <DriverLocationShare driverAccess={driverAccess} />

            {doneSteps.length ? (
              <div className="flex flex-wrap gap-1.5">
                {doneSteps.map((step) => (
                  <span key={step.status} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {step.label}
                  </span>
                ))}
              </div>
            ) : null}

            {currentStep ? (
              <div className="grid gap-2">
                <p className="text-[12px] font-semibold text-ink-soft">ขั้นตอนตอนนี้</p>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => advanceTrip(currentStep.status, tripStep + 1)}
                  className="flex min-h-14 items-center justify-center gap-2 rounded-command bg-operation px-4 text-[16px] font-bold text-white disabled:opacity-60"
                >
                  {currentStep.label}
                </button>
                {laterSteps.length ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setNextStepsOpen((v) => !v)}
                      className="flex items-center justify-between rounded-card border border-border bg-white px-3 py-2 text-[12px] font-semibold text-ink-soft"
                    >
                      ขั้นตอนถัดไป ({laterSteps.length})
                      <ChevronDown className={`h-4 w-4 transition ${nextStepsOpen ? "rotate-180" : ""}`} />
                    </button>
                    {nextStepsOpen ? (
                      <div className="grid gap-1.5">
                        {laterSteps.map((step) => (
                          <p key={step.status} className="rounded-card border border-border bg-canvas px-3 py-2 text-[13px] text-ink-faint">
                            {step.label}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : (
              <p className="rounded-card bg-emerald-50 px-3 py-3 text-center text-[14px] font-bold text-emerald-800">งานนี้เสร็จแล้ว ขอบคุณครับ</p>
            )}
          </div>
        ) : null}
      </section>

      {/* instant comms */}
      <div className="grid grid-cols-3 gap-2">
        {coordinatorPhone ? (
          <a
            href={`tel:${coordinatorPhone.replace(/[^\d+]/g, "")}`}
            className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-command bg-operation px-2 text-[12px] font-semibold text-white"
          >
            <Phone className="h-4 w-4" /> โทรศูนย์
          </a>
        ) : (
          <span className="flex min-h-12 items-center justify-center rounded-command border border-border bg-white px-2 text-[11px] text-ink-faint">
            ไม่มีเบอร์
          </span>
        )}
        <a
          href="#driver-chat"
          className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-command border border-border bg-white px-2 text-[12px] font-semibold text-ink"
        >
          <MessageSquare className="h-4 w-4" /> แชท
        </a>
        <button
          type="button"
          onClick={() => setIssueOpen((v) => !v)}
          className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-command border border-amber-300 bg-amber-50 px-2 text-[12px] font-semibold text-amber-800"
        >
          <TriangleAlert className="h-4 w-4" /> แจ้งปัญหา
        </button>
      </div>

      {issueOpen ? (
        <section className="smart-card grid gap-2">
          <p className="text-[13px] font-semibold text-ink">เลือกประเภทปัญหา</p>
          <div className="grid grid-cols-2 gap-2">
            {ISSUE_TYPES.map((issue) => (
              <button
                key={issue.type}
                type="button"
                disabled={isPending}
                onClick={() => reportIssue(issue.type)}
                className="min-h-11 rounded-command border border-border bg-white px-2 text-[13px] font-medium text-ink hover:border-amber-400 disabled:opacity-60"
              >
                {issue.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <DriverChatThread messages={messages} notifications={notifications} onSend={sendMessage} sending={isPending} />
    </div>
  );
}
