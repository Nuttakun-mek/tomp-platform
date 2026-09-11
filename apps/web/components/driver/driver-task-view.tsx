"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CheckCircle2, ChevronDown, MapPin, MessageSquare, Navigation, Phone, RotateCcw, TriangleAlert } from "lucide-react";
import { assignmentStatusUpdateAction, driverIssueReportAction } from "@/app/actions/driver";
import { DriverChatThread } from "@/components/driver/driver-chat-thread";
import { DriverLocationShare } from "@/components/driver/driver-location-share";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";
import type { DriverIssueMessage } from "@/lib/data/driver-operations";
import { enqueueDriverOutbox, flushDriverOutbox, readDriverOutbox, type DriverOutboxItem } from "@/lib/driver/outbox";
import { formatStatusTh } from "@/lib/i18n/status-th";
import type { DriverNotification } from "@tomp/types/domain";
import { buildBridgeMessage, buildGoogleMapsDirectionsUrl, getMobileShell, NATIVE_STATUS_EVENT, parseNativeStatusDetail } from "@tomp/driver-core";
import { resolveCoordinatorPhone, telHref } from "@/lib/domain/contact-numbers";

type DriverGpsLight = "off" | "live" | "stale";
export type DriverTaskViewMode = "home" | "next" | "messages" | "gps";
type TripStatus = "arrived_pickup" | "passenger_onboard" | "completed";

const TRIP_STEPS: Array<{ status: TripStatus; label: string }> = [
  { status: "arrived_pickup", label: "ถึงจุดรับแล้ว" },
  { status: "passenger_onboard", label: "รับผู้โดยสารแล้ว" },
  { status: "completed", label: "เสร็จสิ้นงาน" }
];

const ISSUE_TYPES: Array<{ type: string; label: string; severity: "info" | "warning" | "critical" }> = [
  { type: "delay", label: "การจราจรหนาแน่น / อาจถึงล่าช้า", severity: "warning" },
  { type: "vehicle", label: "รถมีปัญหา", severity: "warning" },
  { type: "passenger", label: "ติดต่อผู้โดยสารไม่ได้", severity: "warning" },
  { type: "route", label: "เส้นทางมีปัญหา", severity: "warning" },
  { type: "safety", label: "ความปลอดภัย", severity: "critical" },
  { type: "other", label: "อื่น ๆ", severity: "warning" }
];

function metaText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function stepFromStatus(status?: string | null) {
  const index = TRIP_STEPS.findIndex((step) => step.status === status);
  return index >= 0 ? index + 1 : 0;
}

function jobTimeLabel(start?: string | null, end?: string | null) {
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `เริ่ม ${fmt(start)}`;
  return "ยังไม่ระบุเวลา";
}

export function DriverTaskView({ driverAccess, view = "home" }: { driverAccess: DriverAccessAssignment; view?: DriverTaskViewMode }) {
  const meta = driverAccess.assignment.metadata;
  const pickup = metaText(meta.pickupLocation || meta.pickup_location, "ยังไม่ระบุจุดรับ");
  const dropoff = metaText(meta.dropoffLocation || meta.dropoff_location, "ยังไม่ระบุจุดส่ง");
  const commitmentTime = metaText(meta.commitmentTime || meta.commitment_time, "ยังไม่ระบุเวลา");
  const mapsUrl = buildGoogleMapsDirectionsUrl(dropoff, pickup);
  // "ยังไม่ระบุ" used to reach here from the packet and render as a dial button
  // that called nothing. resolveCoordinatorPhone treats a digitless value as
  // unset, so the button is hidden instead of dead.
  const coordinatorPhone = resolveCoordinatorPhone(
    { coordinatorPhone: driverAccess.packet?.contactInstruction?.coordinatorPhone },
    meta
  ) || resolveCoordinatorPhone(meta, driverAccess.project.metadata);

  const ids = useMemo(() => ({
    projectId: driverAccess.project.id,
    assignmentId: driverAccess.assignment.id,
    driverId: driverAccess.driver.id
  }), [driverAccess.assignment.id, driverAccess.driver.id, driverAccess.project.id]);

  const [tripStep, setTripStep] = useState(() => stepFromStatus(driverAccess.latestStatus?.status));
  const [banner, setBanner] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [issueOpen, setIssueOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(true);
  const [nextStepsOpen, setNextStepsOpen] = useState(false);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<DriverNotification[]>(driverAccess.notifications);
  const [messages, setMessages] = useState<DriverIssueMessage[]>(driverAccess.messages);
  const [dayAssignments, setDayAssignments] = useState(driverAccess.dayAssignments);
  const [gpsLight, setGpsLight] = useState<DriverGpsLight>("off");
  const [outboxCount, setOutboxCount] = useState(0);
  const seenIds = useRef(new Set(driverAccess.notifications.map((notification) => notification.id)));

  const sendOutboxItem = useCallback(async (item: DriverOutboxItem) => {
    if (item.kind === "status") return assignmentStatusUpdateAction(item.payload);
    return driverIssueReportAction(item.payload);
  }, []);

  const flushPending = useCallback(async () => {
    const result = await flushDriverOutbox(driverAccess.token, sendOutboxItem);
    setOutboxCount(result.remaining);
    if (result.sent > 0) setBanner({ tone: "ok", text: `ส่งข้อมูลที่ค้างไว้สำเร็จ ${result.sent} รายการ` });
  }, [driverAccess.token, sendOutboxItem]);

  useEffect(() => {
    setOutboxCount(readDriverOutbox(driverAccess.token).length);
    const onOnline = () => void flushPending();
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => void flushPending(), 30000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [driverAccess.token, flushPending]);

  useEffect(() => {
    let alive = true;
    let etag: string | null = null;
    async function poll() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/driver/updates`, {
          cache: "no-store",
          headers: etag ? { "if-none-match": etag } : undefined
        });
        if (!alive) return;
        etag = res.headers.get("etag") ?? etag;
        if (res.status === 304) return; // nothing changed since the last poll
        const json = (await res.json()) as {
          success?: boolean;
          data?: {
            latestStatus?: { status: string; at: string } | null;
            dayAssignments?: DriverAccessAssignment["dayAssignments"];
            notifications?: DriverNotification[];
            messages?: DriverIssueMessage[];
          };
        };
        if (!json.success || !json.data) return;
        if (json.data.latestStatus?.status) {
          setTripStep((current) => Math.max(current, stepFromStatus(json.data?.latestStatus?.status)));
        }
        if (Array.isArray(json.data.dayAssignments)) setDayAssignments(json.data.dayAssignments);
        if (Array.isArray(json.data.messages)) setMessages(json.data.messages);
        if (Array.isArray(json.data.notifications)) {
          setNotifications(json.data.notifications);
          for (const notification of json.data.notifications) {
            if (!seenIds.current.has(notification.id)) {
              seenIds.current.add(notification.id);
              setBanner({ tone: "info", text: `ข้อความจากศูนย์ควบคุม: ${notification.title || notification.body}` });
              getMobileShell(window)?.postMessage(buildBridgeMessage("driver.notification.unread", { count: 1 }));
            }
          }
        }
      } catch {
        // Keep the last known state and let the outbox handle user actions.
      }
    }
    const timer = window.setInterval(poll, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    void poll();
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [driverAccess.token]);

  useEffect(() => {
    const handleNativeStatus = (event: Event) => {
      const payload = parseNativeStatusDetail((event as CustomEvent).detail);
      if (!payload) return;
      if (payload.status === "gps_sharing") setGpsLight("live");
      if (payload.status === "gps_stopped" || payload.status === "gps_error" || payload.status === "session_missing") setGpsLight("off");
    };
    window.addEventListener(NATIVE_STATUS_EVENT, handleNativeStatus);
    return () => window.removeEventListener(NATIVE_STATUS_EVENT, handleNativeStatus);
  }, []);

  function enqueueFailed(kind: "status" | "message" | "issue", payload: Record<string, unknown>, text: string) {
    enqueueDriverOutbox(driverAccess.token, { kind, payload });
    setOutboxCount(readDriverOutbox(driverAccess.token).length);
    setBanner({ tone: "error", text });
  }

  function advanceTrip(status: TripStatus, nextIndex: number) {
    const payload = { ...ids, status, source: "driver_qr", metadata: {} };
    setBanner(null);
    startTransition(async () => {
      const result = await assignmentStatusUpdateAction(payload);
      if (result.success) {
        setTripStep(nextIndex);
        setBanner({ tone: "ok", text: "อัปเดตสถานะให้ศูนย์ควบคุมแล้ว" });
      } else {
        enqueueFailed("status", payload, result.error || "ส่งสถานะไม่สำเร็จ ระบบจะลองส่งใหม่เมื่อเชื่อมต่อได้");
      }
    });
  }

  function reportIssue(type: string) {
    const issue = ISSUE_TYPES.find((item) => item.type === type);
    const payload = {
      ...ids,
      issueType: type,
      severity: issue?.severity || "warning",
      message: issue?.label || type,
      metadata: { via: "driver_task_view" }
    };
    setBanner(null);
    startTransition(async () => {
      const result = await driverIssueReportAction(payload);
      setIssueOpen(false);
      if (result.success) {
        setBanner({ tone: "ok", text: "แจ้งปัญหาแล้ว ศูนย์ควบคุมจะติดต่อกลับ" });
      } else {
        enqueueFailed("issue", payload, result.error || "แจ้งปัญหาไม่สำเร็จ ระบบจะลองส่งใหม่เมื่อเชื่อมต่อได้");
      }
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
    const payload = {
      ...ids,
      issueType: "message",
      severity: "info",
      message: value,
      metadata: { via: "driver_task_view", kind: "driver_message" }
    };
    setMessages((current) => [...current, optimistic]);
    startTransition(async () => {
      const result = await driverIssueReportAction(payload);
      if (!result.success) {
        enqueueFailed("message", payload, result.error || "ส่งข้อความไม่สำเร็จ ระบบจะลองส่งใหม่เมื่อเชื่อมต่อได้");
      }
    });
  }

  const gpsDot = gpsLight === "live" ? "bg-emerald-500" : gpsLight === "stale" ? "bg-amber-500" : "bg-slate-300";
  const gpsLabel = gpsLight === "live" ? "กำลังส่ง GPS" : gpsLight === "stale" ? "GPS ขาดช่วง" : "ยังไม่ได้ส่ง GPS";
  const currentStep = TRIP_STEPS[tripStep];
  const doneSteps = TRIP_STEPS.slice(0, tripStep);
  const laterSteps = TRIP_STEPS.slice(tripStep + 1);
  const showTask = view === "home" || view === "next";
  const showGps = view === "home" || view === "gps";
  const showAssignments = view === "home" || view === "next";
  const showComms = view === "home" || view === "messages";
  const viewTitle =
    view === "next"
      ? "ลำดับภารกิจตามแผน"
      : view === "messages"
        ? "การสื่อสารกับศูนย์ควบคุม"
        : view === "gps"
          ? "การส่งตำแหน่ง GPS"
          : "ภารกิจปัจจุบัน";

  return (
    <div id="driver-home" className="grid gap-3 pb-6">
      <header className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.16em] text-operation">{driverAccess.project.projectName}</p>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
            <span className={`h-2 w-2 rounded-full ${gpsDot}`} />
            {gpsLabel}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <h1 className="min-w-0 truncate text-2xl font-bold text-ink">Call Sign {driverAccess.callSign.callSign}</h1>
          <span className="shrink-0 rounded-full bg-operation-soft px-2.5 py-1 text-[11px] font-semibold text-operation">
            {formatStatusTh(driverAccess.assignment.status)}
          </span>
        </div>
        <p className="text-[13px] font-semibold text-ink-soft">{viewTitle}</p>
      </header>

      <section className="rounded-card border border-border bg-white">
        <button
          type="button"
          onClick={() => setIdentityOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        >
          <span className="min-w-0 text-[13px]">
            <span className="font-semibold text-ink">{driverAccess.driver.fullName}</span>
            <span className="text-ink-faint"> / {driverAccess.vehicle.plateNumber}</span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-ink-faint transition ${identityOpen ? "rotate-180" : ""}`} />
        </button>
        {identityOpen ? (
          <div className="grid gap-1 border-t border-border px-3 py-2.5 text-[13px] text-ink-soft">
            <p><span className="font-semibold text-ink">คนขับ</span> / {driverAccess.driver.fullName} / {driverAccess.driver.phone || "ยังไม่มีเบอร์"}</p>
            <p><span className="font-semibold text-ink">รถ</span> / {driverAccess.vehicle.plateNumber} / {driverAccess.vehicle.vehicleType} / {driverAccess.vehicle.capacity || 0} ที่นั่ง</p>
          </div>
        ) : null}
      </section>

      {banner ? (
        <p className={`rounded-card px-3 py-2 text-[13px] font-semibold ${
          banner.tone === "ok" ? "bg-emerald-50 text-emerald-800" : banner.tone === "info" ? "bg-blue-50 text-blue-800" : "bg-rose-50 text-rose-700"
        }`}>
          {banner.text}
        </p>
      ) : null}

      {outboxCount > 0 ? (
        <button
          type="button"
          onClick={() => void flushPending()}
          className="flex items-center justify-center gap-2 rounded-card border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-800"
        >
          <RotateCcw className="h-4 w-4" /> มีข้อมูลรอส่ง {outboxCount} รายการ กดเพื่อลองส่งอีกครั้ง
        </button>
      ) : null}

      {/* Card: the job to do now — route, target time, and progress steps together. */}
      {showTask ? <section id="driver-current-task" className="smart-card grid gap-2.5 scroll-mt-3">
        <p className="text-[13px] font-bold text-ink">ภารกิจปัจจุบัน</p>
        <div className="grid gap-2">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-operation" />
            <span className="text-[13px]"><span className="font-semibold text-ink">จุดรับ</span> / {pickup}</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <span className="text-[13px]"><span className="font-semibold text-ink">จุดส่ง</span> / {dropoff}</span>
          </div>
          <p className="text-[12px] text-ink-faint">เวลาที่ต้องถึง {commitmentTime}</p>
        </div>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-12 items-center justify-center gap-2 rounded-command bg-route px-4 text-[15px] font-semibold text-white"
        >
          <Navigation className="h-4 w-4" /> เปิด Google Maps
        </a>

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
          <div id="driver-next-action" className="grid gap-2 scroll-mt-3">
            <p className="text-[12px] font-semibold text-ink-soft">ขั้นตอนถัดไปที่ต้องดำเนินการ</p>
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
                  onClick={() => setNextStepsOpen((value) => !value)}
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
          <p className="rounded-card bg-emerald-50 px-3 py-3 text-center text-[14px] font-bold text-emerald-800">งานนี้เสร็จสิ้นแล้ว</p>
        )}
      </section> : null}

      {/* Card: location sharing — its own card so it can be hidden whole while sharing runs. */}
      {showGps ? <section id="driver-gps" className="smart-card grid gap-3 scroll-mt-3">
        <a
          href={`tompdriver://?token=${encodeURIComponent(driverAccess.token)}`}
          className="rounded-card border border-operation/30 bg-operation-soft px-3 py-2 text-center text-[12px] font-semibold text-operation"
        >
          เปิดในแอป TOMP Driver เพื่อส่ง GPS ต่อเนื่องเมื่อปิดจอ
        </a>
        <DriverLocationShare driverAccess={driverAccess} onStatusChange={setGpsLight} />
      </section> : null}

      {showAssignments && (view === "next" || dayAssignments.length > 1) ? (
        <section className="smart-card grid gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-bold text-ink">ลำดับงานวันนี้</p>
              <p className="text-[12px] text-ink-faint">เรียงตามลำดับปฏิบัติงาน · แตะเพื่อดูรายละเอียด</p>
            </div>
            <span className="rounded-full bg-canvas px-2.5 py-1 text-[11px] font-semibold text-ink-soft">{dayAssignments.length} งาน</span>
          </div>
          {!dayAssignments.length ? (
            <p className="rounded-card border border-dashed border-border bg-canvas px-3 py-5 text-center text-[13px] font-semibold text-ink-soft">
              ยังไม่มีงานถัดไปในลำดับงานวันนี้
            </p>
          ) : null}
          <div className="grid gap-2">
            {dayAssignments.map((item) => {
              const open = openJobId === item.assignmentId;
              const done = item.status === "completed" || item.status === "cancelled";
              const jobMapsUrl = buildGoogleMapsDirectionsUrl(item.dropoff, item.pickup);
              return (
                <article
                  key={item.assignmentId}
                  className={`overflow-hidden rounded-card border ${
                    item.isCurrent
                      ? "border-operation/40 bg-operation-soft"
                      : item.urgent
                        ? "border-amber-300 bg-amber-50"
                        : done
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-border bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenJobId(open ? null : item.assignmentId)}
                    aria-expanded={open}
                    className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
                        <span>{item.sequence}. Call Sign {item.callSign}</span>
                        {item.urgent ? <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">ด่วน</span> : null}
                        {item.isNext ? <span className="rounded-full bg-route px-1.5 py-0.5 text-[10px] font-bold text-white">ทำต่อไป</span> : null}
                      </p>
                      <p className="mt-1 truncate text-[12px] text-ink-soft">{item.pickup} ไป {item.dropoff}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                        {item.isCurrent ? "งานปัจจุบัน" : formatStatusTh(item.status)}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-ink-faint transition ${open ? "rotate-180" : ""}`} />
                    </span>
                  </button>
                  {open ? (
                    <div className="grid gap-1.5 border-t border-black/5 px-3 py-2.5 text-[12px] text-ink-soft">
                      <p><span className="font-semibold text-ink">จุดรับ</span> / {item.pickup}</p>
                      <p><span className="font-semibold text-ink">จุดส่ง</span> / {item.dropoff}</p>
                      <p><span className="font-semibold text-ink">เวลา</span> / {jobTimeLabel(item.startTime, item.endTime)}</p>
                      <a
                        href={jobMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 flex min-h-10 items-center justify-center gap-2 rounded-command bg-route px-4 text-[13px] font-semibold text-white"
                      >
                        <Navigation className="h-3.5 w-3.5" /> เส้นทางงานนี้
                      </a>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {view === "messages" ? (
        <section className="smart-card grid gap-1.5">
          <p className="text-[13px] font-bold text-ink">ศูนย์การสื่อสาร</p>
          <p className="text-[12px] leading-5 text-ink-faint">
            ใช้สำหรับส่งข้อความ แจ้งเหตุขัดข้อง หรือโทรติดต่อศูนย์ควบคุมระหว่างปฏิบัติงาน
          </p>
        </section>
      ) : null}

      {showComms ? <div className="grid grid-cols-3 gap-2">
        {coordinatorPhone ? (
          <a
            href={telHref(coordinatorPhone) ?? "#"}
            className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-command bg-operation px-2 text-[12px] font-semibold text-white"
          >
            <Phone className="h-4 w-4" /> โทรศูนย์
          </a>
        ) : (
          <span className="flex min-h-12 items-center justify-center rounded-command border border-border bg-white px-2 text-[11px] text-ink-faint">
            ยังไม่มีเบอร์
          </span>
        )}
        <a
          href="#driver-chat"
          className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-command border border-border bg-white px-2 text-[12px] font-semibold text-ink"
        >
          <MessageSquare className="h-4 w-4" /> ข้อความ
        </a>
        <button
          type="button"
          onClick={() => setIssueOpen((value) => !value)}
          className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-command border border-amber-300 bg-amber-50 px-2 text-[12px] font-semibold text-amber-800"
        >
          <TriangleAlert className="h-4 w-4" /> แจ้งปัญหา
        </button>
      </div> : null}

      {showComms && issueOpen ? (
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

      {showComms ? <DriverChatThread messages={messages} notifications={notifications} onSend={sendMessage} sending={isPending} /> : null}
    </div>
  );
}
