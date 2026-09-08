"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ChevronDown, MapPin, Navigation, Phone, TriangleAlert } from "lucide-react";
import { assignmentStatusUpdateAction, driverCheckinAction, driverIssueReportAction } from "@/app/actions/driver";
import { DriverLocationShare } from "@/components/driver/driver-location-share";
import { NotificationCard } from "@/components/ui/notification-card";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";
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
  const [notesOpen, setNotesOpen] = useState(false);

  const ids = {
    projectId: driverAccess.project.id,
    assignmentId: driverAccess.assignment.id,
    driverId: driverAccess.driver.id
  };

  function markReady() {
    setBanner(null);
    startTransition(async () => {
      const result = await driverCheckinAction({
        ...ids,
        status: "ready",
        confirmedName: true,
        confirmedPhone: true,
        confirmedVehicle: true,
        gpsConsent: true,
        metadata: { via: "driver_task_view" }
      });
      if (result.success) {
        setPhase("ready");
        setBanner({ tone: "ok", text: "แจ้งความพร้อมแล้ว ศูนย์ควบคุมได้รับข้อมูล" });
      } else {
        setBanner({ tone: "error", text: result.error || "บันทึกไม่สำเร็จ ลองอีกครั้ง" });
      }
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

  const primaryDisabled = isPending;

  return (
    <div className="grid gap-3 pb-4">
      {/* header */}
      <header className="grid gap-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-operation">{driverAccess.project.projectName}</p>
          <span className="rounded-full bg-operation-soft px-2.5 py-1 text-[11px] font-semibold text-operation">
            {formatStatusTh(driverAccess.assignment.status)}
          </span>
        </div>
        <h1 className="text-xl font-bold text-ink">Call Sign {driverAccess.callSign.callSign}</h1>
      </header>

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
          <button
            type="button"
            onClick={markReady}
            disabled={primaryDisabled}
            className="flex min-h-14 items-center justify-center gap-2 rounded-command bg-operation px-4 text-[16px] font-bold text-white disabled:opacity-60"
          >
            <CheckCircle2 className="h-5 w-5" />
            {isPending ? "กำลังบันทึก..." : "พร้อมรับงาน"}
          </button>
        ) : null}

        {phase === "ready" ? (
          <>
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> แจ้งความพร้อมแล้ว
            </p>
            <button
              type="button"
              onClick={() => setPhase("sharing")}
              className="flex min-h-14 items-center justify-center gap-2 rounded-command bg-route px-4 text-[16px] font-bold text-white"
            >
              <Navigation className="h-5 w-5" /> เริ่มแชร์ตำแหน่ง GPS
            </button>
          </>
        ) : null}

        {phase === "sharing" ? (
          <div className="grid gap-3">
            <DriverLocationShare driverAccess={driverAccess} />
            <div className="grid gap-2">
              <p className="text-[12px] font-semibold text-ink-soft">อัปเดตสถานะการเดินทาง</p>
              {TRIP_STEPS.map((step, index) => (
                <button
                  key={step.status}
                  type="button"
                  disabled={isPending || index < tripStep}
                  onClick={() => advanceTrip(step.status, index + 1)}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-command px-4 text-[14px] font-semibold transition ${
                    index < tripStep
                      ? "bg-emerald-50 text-emerald-700"
                      : index === tripStep
                        ? "bg-operation text-white"
                        : "border border-border bg-white text-ink-faint"
                  }`}
                >
                  {index < tripStep ? <CheckCircle2 className="h-4 w-4" /> : null}
                  {step.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* secondary actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setIssueOpen((v) => !v)}
          className="flex min-h-12 items-center justify-center gap-1.5 rounded-command border border-amber-300 bg-amber-50 px-3 text-[13px] font-semibold text-amber-800"
        >
          <TriangleAlert className="h-4 w-4" /> แจ้งปัญหา
        </button>
        {coordinatorPhone ? (
          <a
            href={`tel:${coordinatorPhone.replace(/[^\d+]/g, "")}`}
            className="flex min-h-12 items-center justify-center gap-1.5 rounded-command border border-border bg-white px-3 text-[13px] font-semibold text-ink"
          >
            <Phone className="h-4 w-4" /> โทรผู้ประสานงาน
          </a>
        ) : (
          <span className="flex min-h-12 items-center justify-center rounded-command border border-border bg-white px-3 text-[12px] text-ink-faint">
            ไม่มีเบอร์ติดต่อ
          </span>
        )}
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

      {/* notifications */}
      {driverAccess.notifications.length ? (
        <section className="grid gap-2">
          {driverAccess.notifications.slice(0, 3).map((n) => (
            <NotificationCard key={n.id} title={n.title || "แจ้งเตือน"} body={n.body} at={n.createdAt} tone={n.priority === "critical" ? "critical" : "info"} />
          ))}
        </section>
      ) : null}

      {/* optional details */}
      <button
        type="button"
        onClick={() => setNotesOpen((v) => !v)}
        className="flex items-center justify-between rounded-card border border-border bg-white px-3 py-2.5 text-[13px] font-semibold text-ink-soft"
      >
        รายละเอียดเพิ่มเติม (ไม่บังคับ)
        <ChevronDown className={`h-4 w-4 transition ${notesOpen ? "rotate-180" : ""}`} />
      </button>
      {notesOpen ? (
        <section className="smart-card grid gap-1.5 text-[13px] text-ink-soft">
          <p><span className="font-semibold text-ink">คนขับ</span> · {driverAccess.driver.fullName} · {driverAccess.driver.phone}</p>
          <p><span className="font-semibold text-ink">รถ</span> · {driverAccess.vehicle.plateNumber} · {driverAccess.vehicle.vehicleType}</p>
          <p><span className="font-semibold text-ink">เวอร์ชันงาน</span> · {driverAccess.assignment.currentVersion}</p>
          <p className="text-ink-faint">ถ่ายรูปรถ/ป้ายทะเบียน — ทำได้ผ่านแอปมือถือ (ระยะถัดไป)</p>
        </section>
      ) : null}
    </div>
  );
}
