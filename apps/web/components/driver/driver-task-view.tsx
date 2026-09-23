"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CarFront, CheckCircle2, ChevronDown, Clock3, Home, ListChecks, LogIn, LogOut, MapPin, MessageCircle, Navigation, Phone, RotateCcw, TriangleAlert, UserRound } from "lucide-react";
import { assignmentStatusUpdateAction, driverIssueReportAction } from "@/app/actions/driver";
import { DriverChatThread } from "@/components/driver/driver-chat-thread";
import { DriverLocationShare } from "@/components/driver/driver-location-share";
import type { DriverAccessAssignment, DriverWorkSessionState } from "@/lib/data/driver-access";
import type { DriverMessageAttachment } from "@/lib/data/driver-message-attachments";
import type { DriverIssueMessage } from "@/lib/data/driver-operations";
import { enqueueDriverOutbox, flushDriverOutbox, readDriverOutbox, type DriverOutboxItem } from "@/lib/driver/outbox";
import { createDriverMessageClientEventId, extractDriverMessageClientEventId } from "@/lib/driver/message-idempotency";
import { formatStatusTh } from "@/lib/i18n/status-th";
import type { DriverNotification } from "@tomp/types/domain";
import { buildBridgeMessage, buildGoogleMapsDirectionsUrl, getMobileShell, NATIVE_STATUS_EVENT, parseNativeStatusDetail, parseViewSwitchDetail, VIEW_SWITCH_EVENT } from "@tomp/driver-core";
import { resolveCoordinatorPhone, telHref } from "@/lib/domain/contact-numbers";

type DriverGpsLight = "off" | "live" | "stale";
export type DriverTaskViewMode = "home" | "next" | "messages" | "gps";
type TripStatus = "arrived_pickup" | "passenger_onboard" | "completed";
type WorkSessionStatus = "work_started" | "work_ended";
type StatusIcon = typeof Home;

const WEB_DRIVER_TABS: Array<{ view: DriverTaskViewMode; label: string; icon: typeof Home }> = [
  { view: "home", label: "หน้าหลัก", icon: Home },
  { view: "next", label: "แผนงาน", icon: ListChecks },
  { view: "messages", label: "ข้อความ", icon: MessageCircle },
  { view: "gps", label: "ตำแหน่ง", icon: MapPin }
];

const TRIP_STEPS: Array<{ status: TripStatus; label: string }> = [
  { status: "arrived_pickup", label: "ถึงจุดรับแล้ว" },
  { status: "passenger_onboard", label: "รับผู้โดยสารแล้ว" },
  { status: "completed", label: "เสร็จสิ้นงาน" }
];

const ISSUE_TYPES: Array<{ type: string; label: string; severity: "info" | "warning" | "critical" }> = [
  { type: "delay", label: "การจราจรหนาแน่น / อาจถึงล่าช้า", severity: "warning" },
  { type: "vehicle", label: "เหตุขัดข้องเกี่ยวกับรถ", severity: "warning" },
  { type: "passenger", label: "ติดต่อผู้โดยสารไม่ได้", severity: "warning" },
  { type: "route", label: "เหตุขัดข้องด้านเส้นทาง", severity: "warning" },
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
  const fmt = (iso: string) => new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(iso));
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `เริ่ม ${fmt(start)}`;
  return "ยังไม่ระบุเวลา";
}

function mergePendingMessages(serverMessages: DriverIssueMessage[], pending: Map<string, DriverIssueMessage>) {
  const serverClientIds = new Set(serverMessages.map((message) => message.clientEventId).filter((value): value is string => Boolean(value)));
  for (const clientEventId of serverClientIds) pending.delete(clientEventId);
  return [...serverMessages, ...pending.values()].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function timeStampLabel(value?: string | null) {
  if (!value) return "ยังไม่มีเวลา";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok"
  }).format(new Date(value));
}

function gpsStatusPresentation(light: DriverGpsLight): { label: string; Icon: StatusIcon; className: string; iconClassName: string } {
  if (light === "live") {
    return {
      label: "กำลังส่ง GPS",
      Icon: MapPin,
      className: "bg-white/10 text-emerald-50 ring-emerald-300/35",
      iconClassName: "bg-emerald-400 text-emerald-950"
    };
  }
  if (light === "stale") {
    return {
      label: "GPS ขาดช่วง",
      Icon: TriangleAlert,
      className: "bg-white/10 text-amber-50 ring-amber-300/35",
      iconClassName: "bg-amber-300 text-amber-950"
    };
  }
  return {
    label: "ยังไม่ได้ส่ง GPS",
    Icon: TriangleAlert,
    className: "bg-white/10 text-slate-100 ring-white/20",
    iconClassName: "bg-slate-400 text-white"
  };
}

export function DriverTaskView({ driverAccess, view: initialView = "home" }: { driverAccess: DriverAccessAssignment; view?: DriverTaskViewMode }) {
  const router = useRouter();
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
  const [nextStepsOpen, setNextStepsOpen] = useState(false);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<DriverNotification[]>(driverAccess.notifications);
  const [messages, setMessages] = useState<DriverIssueMessage[]>(driverAccess.messages);
  const [dayAssignments, setDayAssignments] = useState(driverAccess.dayAssignments);
  const [workSession, setWorkSession] = useState<DriverWorkSessionState>(driverAccess.workSession);
  const [gpsLight, setGpsLight] = useState<DriverGpsLight>("off");
  const [currentJobAcknowledged, setCurrentJobAcknowledged] = useState(() => (
    Boolean(driverAccess.latestStatus) || ["acknowledged", "active", "completed"].includes(driverAccess.assignment.status)
  ));
  const [outboxCount, setOutboxCount] = useState(0);
  const [insideNativeShell, setInsideNativeShell] = useState(false);
  // Which section is on screen is now state, not a fixed prop: the native shell
  // switches tabs by posting over the bridge rather than reloading this page,
  // so the URL's `view` only seeds the first render.
  const [view, setView] = useState<DriverTaskViewMode>(initialView);
  const seenIds = useRef(new Set(driverAccess.notifications.map((notification) => notification.id)));
  const pendingMessagesRef = useRef<Map<string, DriverIssueMessage>>(new Map());

  const sendOutboxItem = useCallback(async (item: DriverOutboxItem) => {
    if (item.kind === "status") return assignmentStatusUpdateAction(item.payload);
    const result = await driverIssueReportAction(item.payload);
    if (result.success) {
      const clientEventId = extractDriverMessageClientEventId(item.payload.metadata);
      if (clientEventId) {
        pendingMessagesRef.current.delete(clientEventId);
        setMessages((current) => current.map((message) => (
          message.clientEventId === clientEventId ? { ...message, deliveryStatus: "sent" } : message
        )));
      }
    }
    return result;
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
            workSession?: DriverWorkSessionState;
            dayAssignments?: DriverAccessAssignment["dayAssignments"];
            notifications?: DriverNotification[];
            messages?: DriverIssueMessage[];
          };
        };
        if (!json.success || !json.data) return;
        if (json.data.latestStatus?.status) {
          setCurrentJobAcknowledged(true);
          setTripStep((current) => Math.max(current, stepFromStatus(json.data?.latestStatus?.status)));
        }
        if (json.data.workSession) setWorkSession(json.data.workSession);
        if (Array.isArray(json.data.dayAssignments)) setDayAssignments(json.data.dayAssignments);
        if (Array.isArray(json.data.messages)) setMessages(mergePendingMessages(json.data.messages, pendingMessagesRef.current));
        if (Array.isArray(json.data.notifications)) {
          setNotifications(json.data.notifications);
          for (const notification of json.data.notifications) {
            if (!seenIds.current.has(notification.id)) {
              seenIds.current.add(notification.id);
              setBanner({ tone: "info", text: notification.title || notification.body || "มีข้อความใหม่จากศูนย์ควบคุม" });
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
    const updateShellState = () => setInsideNativeShell(Boolean(getMobileShell(window)));
    updateShellState();
    window.addEventListener("tomp:mobile-shell-ready", updateShellState);
    return () => window.removeEventListener("tomp:mobile-shell-ready", updateShellState);
  }, []);

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

  useEffect(() => {
    const handleViewSwitch = (event: Event) => {
      const nextView = parseViewSwitchDetail((event as CustomEvent).detail);
      if (nextView) setView(nextView);
    };
    window.addEventListener(VIEW_SWITCH_EVENT, handleViewSwitch);
    return () => window.removeEventListener(VIEW_SWITCH_EVENT, handleViewSwitch);
  }, []);

  function enqueueFailed(kind: "status" | "message" | "issue", payload: Record<string, unknown>, text: string, id?: string) {
    enqueueDriverOutbox(driverAccess.token, { id, kind, payload });
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
        if (status === "completed") {
          window.setTimeout(() => router.refresh(), 350);
        }
      } else {
        enqueueFailed("status", payload, result.error || "ส่งสถานะไม่สำเร็จ ระบบจะส่งข้อมูลอีกครั้งเมื่อเชื่อมต่อได้");
      }
    });
  }

  function acknowledgeCurrentJob() {
    const payload = { ...ids, status: "acknowledged", source: "driver_qr", metadata: { via: "driver_next_job" } };
    setBanner(null);
    startTransition(async () => {
      const result = await assignmentStatusUpdateAction(payload);
      if (result.success) {
        setCurrentJobAcknowledged(true);
        setBanner({ tone: "ok", text: "รับงานต่อเรียบร้อยแล้ว ศูนย์ควบคุมได้รับสถานะล่าสุด" });
      } else {
        enqueueFailed("status", payload, result.error || "รับงานต่อไม่สำเร็จ ระบบจะส่งข้อมูลอีกครั้งเมื่อเชื่อมต่อได้");
      }
    });
  }

  function updateWorkSession(status: WorkSessionStatus) {
    if (status === "work_ended") {
      const ok = window.confirm("ต้องการบันทึกเวลาสิ้นสุดการปฏิบัติงานหรือไม่ การดำเนินการนี้ใช้สำหรับบันทึกเวลาออก ไม่ใช่การปิดรายการปฏิบัติงาน");
      if (!ok) return;
    }
    const now = new Date().toISOString();
    const payload = {
      ...ids,
      status,
      source: "driver_qr",
      metadata: { category: "work_session", via: "driver_task_view", recordedAt: now }
    };
    setBanner(null);
    startTransition(async () => {
      const result = await assignmentStatusUpdateAction(payload);
      if (result.success) {
        setWorkSession((current) => ({
          status: status === "work_started" ? "active" : "ended",
          startedAt: status === "work_started" ? now : current.startedAt,
          endedAt: status === "work_ended" ? now : null,
          latestAt: now
        }));
        setBanner({ tone: "ok", text: status === "work_started" ? "บันทึกเวลาเริ่มปฏิบัติงานแล้ว" : "บันทึกเวลาสิ้นสุดปฏิบัติงานแล้ว" });
      } else {
        enqueueFailed("status", payload, result.error || "บันทึกเวลาปฏิบัติงานไม่สำเร็จ ระบบจะส่งข้อมูลอีกครั้งเมื่อเชื่อมต่อได้");
      }
    });
  }

  function reportIssue(type: string) {
    const issue = ISSUE_TYPES.find((item) => item.type === type);
    const clientEventId = createDriverMessageClientEventId("issue");
    const payload = {
      ...ids,
      issueType: type,
      severity: issue?.severity || "warning",
      message: issue?.label || type,
      metadata: { via: "driver_task_view", clientEventId }
    };
    setBanner(null);
    startTransition(async () => {
      const result = await driverIssueReportAction(payload);
      setIssueOpen(false);
      if (result.success) {
        setBanner({ tone: "ok", text: "แจ้งเหตุขัดข้องแล้ว ศูนย์ควบคุมจะติดต่อกลับ" });
      } else {
        enqueueFailed("issue", payload, result.error || "แจ้งเหตุขัดข้องไม่สำเร็จ ระบบจะส่งข้อมูลอีกครั้งเมื่อเชื่อมต่อได้", clientEventId);
      }
    });
  }

  function sendMessage(text: string, attachment?: DriverMessageAttachment | null) {
    const value = text.trim();
    if (!value && !attachment) return;
    const clientEventId = createDriverMessageClientEventId("message");
    const optimistic: DriverIssueMessage = {
      id: `local-${clientEventId}`,
      text: value || "ส่งรูปจากคนขับ",
      at: new Date().toISOString(),
      issueType: "message",
      severity: "info",
      clientEventId,
      deliveryStatus: "pending",
      attachment: attachment ?? null
    };
    const storedAttachment = attachment
      ? {
          type: "photo",
          storagePath: attachment.storagePath,
          capturedAt: attachment.capturedAt ?? null,
          latitude: attachment.latitude ?? null,
          longitude: attachment.longitude ?? null,
          accuracy: attachment.accuracy ?? null,
          placeName: attachment.placeName ?? null,
          hasLocation: Boolean(attachment.hasLocation),
          stampApplied: attachment.stampApplied !== false
        }
      : null;
    const payload = {
      ...ids,
      issueType: "message",
      severity: "info",
      message: value || (attachment ? "ส่งรูปจากคนขับ" : ""),
      metadata: { via: "driver_task_view", kind: "driver_message", clientEventId, attachment: storedAttachment }
    };
    pendingMessagesRef.current.set(clientEventId, optimistic);
    setMessages((current) => (
      current.some((message) => message.clientEventId === clientEventId)
        ? current
        : [...current, optimistic].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    ));
    startTransition(async () => {
      const result = await driverIssueReportAction(payload);
      if (!result.success) {
        enqueueFailed("message", payload, result.error || "ส่งข้อความไม่สำเร็จ ระบบจะส่งข้อมูลอีกครั้งเมื่อเชื่อมต่อได้", clientEventId);
      } else {
        pendingMessagesRef.current.delete(clientEventId);
        setMessages((current) => current.map((message) => (
          message.clientEventId === clientEventId ? { ...message, deliveryStatus: "sent" } : message
        )));
      }
    });
  }

  const gpsStatus = gpsStatusPresentation(gpsLight);
  const GpsStatusIcon = gpsStatus.Icon;
  const workSessionLabel =
    workSession.status === "active" ? "กำลังปฏิบัติงาน" : workSession.status === "ended" ? "บันทึกเวลาออกแล้ว" : "ยังไม่บันทึกเวลาเข้า";
  const workSessionClass =
    workSession.status === "active" ? "bg-emerald-300/18 text-emerald-50 ring-emerald-300/30" : workSession.status === "ended" ? "bg-white/10 text-slate-100 ring-white/20" : "bg-amber-300/16 text-amber-50 ring-amber-300/30";
  const needsCurrentJobAcceptance = !currentJobAcknowledged && ["draft", "planned", "published", "parked"].includes(driverAccess.assignment.status);
  const currentStep = TRIP_STEPS[tripStep];
  const doneSteps = TRIP_STEPS.slice(0, tripStep);
  const laterSteps = TRIP_STEPS.slice(tripStep + 1);
  const upcomingAssignments = dayAssignments.filter((item) => !item.isCurrent && item.status !== "completed" && item.status !== "cancelled");
  const showTask = view === "home";
  const showGps = view === "gps";
  const showAssignments = view === "next";
  const showComms = view === "messages";
  return (
    <div
      id="driver-home"
      className={`grid gap-3 ${insideNativeShell ? "pb-6" : "pb-[calc(6.5rem+env(safe-area-inset-bottom))]"}`}
    >
      <header className="relative grid gap-2.5 overflow-hidden rounded-[1.25rem] bg-[radial-gradient(circle_at_84%_12%,rgba(139,226,218,0.28),transparent_32%),radial-gradient(circle_at_12%_86%,rgba(37,99,235,0.2),transparent_34%),linear-gradient(145deg,#0d344c_0%,#0b2538_56%,#071827_100%)] p-3 text-white shadow-[0_16px_38px_rgba(7,24,39,0.24)] ring-1 ring-white/10">
        <span className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full border border-white/10 bg-white/5" aria-hidden />
        <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-white/30" aria-hidden />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5">
          <div className="min-w-0 pr-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-100/80">Call Sign</p>
            <div className="mt-0.5 flex min-w-0 items-baseline gap-2">
              <h1 className="min-w-0 truncate text-[2rem] font-black leading-9 tracking-normal text-white">{driverAccess.callSign.callSign}</h1>
            </div>
            <p className="min-w-0 truncate text-[11px] font-semibold leading-5 text-teal-50/88">{driverAccess.project.projectName}</p>
          </div>
          <div className="flex max-w-[46%] shrink-0 flex-col items-end gap-1.5">
            <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-[10.5px] font-bold ring-1 ${gpsStatus.className}`}>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${gpsStatus.iconClassName}`}>
                <GpsStatusIcon className="h-3 w-3" />
              </span>
              <span className="truncate">{gpsStatus.label}</span>
            </span>
            <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-[10.5px] font-bold ring-1 ${workSessionClass}`}>
              <Clock3 className="h-3 w-3 shrink-0" />
              <span className="truncate">{workSessionLabel}</span>
            </span>
          </div>
        </div>
        <div className="relative grid grid-cols-2 gap-1.5">
          <div className="grid min-w-0 grid-cols-[1.4rem_minmax(0,1fr)] items-center gap-1.5 rounded-[0.85rem] bg-white/10 px-2 py-1.5 ring-1 ring-white/10">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/12 text-teal-100">
              <UserRound className="h-3 w-3" />
            </span>
            <span className="min-w-0">
              <span className="block text-[9.5px] font-semibold leading-3 text-white/55">คนขับ</span>
              <span className="block truncate text-[11.5px] font-bold leading-4 text-white">{driverAccess.driver.fullName}</span>
            </span>
          </div>
          <div className="grid min-w-0 grid-cols-[1.4rem_minmax(0,1fr)] items-center gap-1.5 rounded-[0.85rem] bg-white/10 px-2 py-1.5 ring-1 ring-white/10">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/12 text-teal-100">
              <CarFront className="h-3 w-3" />
            </span>
            <span className="min-w-0">
              <span className="block text-[9.5px] font-semibold leading-3 text-white/55">รถ</span>
              <span className="block truncate text-[11.5px] font-bold leading-4 text-white">{driverAccess.vehicle.plateNumber} / {driverAccess.vehicle.vehicleType}</span>
            </span>
          </div>
        </div>
      </header>

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
          <RotateCcw className="h-4 w-4" /> มีข้อมูลรอส่ง {outboxCount} รายการ เลือกเพื่อส่งข้อมูลอีกครั้ง
        </button>
      ) : null}

      {showGps ? <section id="driver-work-session" className="grid gap-3 rounded-[1.15rem] border border-teal-100 bg-white/95 p-3 shadow-[0_10px_24px_rgba(16,32,51,0.06)] scroll-mt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-ink">เวลาปฏิบัติงาน</p>
            <p className="mt-0.5 text-[12px] leading-5 text-ink-faint">ใช้สำหรับบันทึกเวลาเข้าออกเท่านั้น ไม่ใช่สถานะของรายการปฏิบัติงาน</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            workSession.status === "active" ? "bg-emerald-50 text-emerald-800" : workSession.status === "ended" ? "bg-slate-100 text-slate-700" : "bg-amber-50 text-amber-800"
          }`}>
            {workSessionLabel}
          </span>
        </div>
        <div className="grid gap-2 rounded-[1rem] bg-canvas/70 p-2.5 text-[12px] text-ink-soft">
          <p><span className="font-semibold text-ink">เวลาเข้า</span> / {timeStampLabel(workSession.startedAt)}</p>
          <p><span className="font-semibold text-ink">เวลาออก</span> / {timeStampLabel(workSession.endedAt)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isPending || workSession.status === "active"}
            onClick={() => updateWorkSession("work_started")}
            className="flex min-h-12 items-center justify-center gap-2 rounded-[1rem] bg-operation px-3 text-[13px] font-bold text-white shadow-sm transition active:scale-[0.99] disabled:bg-slate-300"
          >
            <LogIn className="h-4 w-4" /> เริ่มปฏิบัติงาน
          </button>
          <button
            type="button"
            disabled={isPending || workSession.status !== "active"}
            onClick={() => updateWorkSession("work_ended")}
            className="flex min-h-12 items-center justify-center gap-2 rounded-[1rem] border border-slate-300 bg-white px-3 text-[13px] font-bold text-slate-700 shadow-sm transition active:scale-[0.99] disabled:bg-slate-100 disabled:text-slate-400"
          >
            <LogOut className="h-4 w-4" /> สิ้นสุดปฏิบัติงาน
          </button>
        </div>
      </section> : null}

      {showTask ? <section id="driver-current-task" className="grid gap-3 rounded-[1.15rem] border border-border/70 bg-white/95 p-3 shadow-[0_10px_24px_rgba(16,32,51,0.06)] scroll-mt-3">
        <p className="text-[13px] font-bold text-ink">รายการปฏิบัติงาน</p>
        <div className="grid grid-cols-[1fr_5.25rem] gap-2 rounded-[1rem] bg-canvas/70 p-2.5">
          <div className="grid min-w-0 gap-2">
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
            className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-[0.9rem] bg-route px-2 text-center text-[12px] font-bold leading-4 text-white shadow-[0_8px_16px_rgba(37,99,235,0.2)] transition active:scale-[0.99]"
          >
            <Navigation className="h-4 w-4" />
            <span>Google<br />Maps</span>
          </a>
        </div>

        {doneSteps.length ? (
          <div className="flex flex-wrap gap-1.5">
            {doneSteps.map((step) => (
              <span key={step.status} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> {step.label}
              </span>
            ))}
          </div>
        ) : null}

        {needsCurrentJobAcceptance ? (
          <div id="driver-next-action" className="grid gap-2 scroll-mt-3">
            <p className="text-[12px] font-semibold text-ink-soft">งานถัดไปพร้อมให้ดำเนินการ</p>
            <button
              type="button"
              disabled={isPending}
              onClick={acknowledgeCurrentJob}
              className="flex min-h-14 items-center justify-center gap-2 rounded-[1rem] bg-operation px-4 text-[16px] font-bold text-white shadow-[0_10px_20px_rgba(8,123,115,0.22)] transition active:scale-[0.99] disabled:opacity-60"
            >
              <CheckCircle2 className="h-5 w-5" />
              รับงานต่อ
            </button>
            <p className="rounded-card bg-operation-soft px-3 py-2 text-[12px] leading-5 text-operation">
              งานนี้ใช้การยืนยันความพร้อมและหลักฐานรถจากการเริ่มปฏิบัติงานวันนี้แล้ว ไม่ต้องถ่ายรูปหรือยืนยันข้อมูลซ้ำ
            </p>
          </div>
        ) : currentStep ? (
          <div id="driver-next-action" className="grid gap-2 scroll-mt-3">
            <p className="text-[12px] font-semibold text-ink-soft">ขั้นตอนถัดไปที่ต้องดำเนินการ</p>
            <button
              type="button"
              disabled={isPending}
              onClick={() => advanceTrip(currentStep.status, tripStep + 1)}
              className="flex min-h-14 items-center justify-center gap-2 rounded-[1rem] bg-operation px-4 text-[16px] font-bold text-white shadow-[0_10px_20px_rgba(8,123,115,0.22)] transition active:scale-[0.99] disabled:opacity-60"
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

      {showGps ? <section id="driver-gps" className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-white/95 p-3.5 shadow-[0_12px_30px_rgba(16,32,51,0.07)] scroll-mt-3">
        <a
          href={`tompdriver://?token=${encodeURIComponent(driverAccess.token)}`}
          className="rounded-card border border-operation/30 bg-operation-soft px-3 py-2 text-center text-[12px] font-semibold text-operation"
        >
          เปิดในแอป TOMP Driver เพื่อส่ง GPS ต่อเนื่องเมื่อปิดจอ
        </a>
        <DriverLocationShare driverAccess={driverAccess} onStatusChange={setGpsLight} />
      </section> : null}

      {showAssignments ? (
        <section className="grid gap-2.5 rounded-[1.25rem] border border-border/70 bg-white/95 p-3.5 shadow-[0_12px_30px_rgba(16,32,51,0.07)]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-bold text-ink">ลำดับงานที่ต้องดำเนินการถัดไป</p>
              <p className="text-[12px] text-ink-faint">แสดงเฉพาะรายการที่ต้องดำเนินการหลังจากงานปัจจุบัน</p>
            </div>
            <span className="rounded-full bg-canvas px-2.5 py-1 text-[11px] font-semibold text-ink-soft">{upcomingAssignments.length} งาน</span>
          </div>
          {!upcomingAssignments.length ? (
            <div className="rounded-[1rem] border border-dashed border-border bg-canvas/80 px-4 py-8 text-center">
              <p className="text-[15px] font-bold text-ink">ยังไม่มีงานถัดไปในขณะนี้</p>
              <p className="mt-1 text-[12px] leading-5 text-ink-faint">เมื่อศูนย์ควบคุมเพิ่มงานใหม่ ระบบจะแสดงในหน้านี้โดยอัตโนมัติ</p>
            </div>
          ) : null}
          <div className="grid gap-2">
            {upcomingAssignments.map((item) => {
              const open = openJobId === item.assignmentId;
              return (
                <article
                  key={item.assignmentId}
                  className={`overflow-hidden rounded-[1rem] border shadow-sm ${
                    item.urgent ? "border-amber-300 bg-amber-50" : "border-border bg-white"
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
                        <span>{item.sequence}. หน่วย {item.callSign}</span>
                        {item.urgent ? <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">ด่วน</span> : null}
                        {item.isNext ? <span className="rounded-full bg-route px-1.5 py-0.5 text-[10px] font-bold text-white">ทำต่อไป</span> : null}
                      </p>
                      <p className="mt-1 truncate text-[12px] text-ink-soft">{item.pickup} ไป {item.dropoff}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                        {formatStatusTh(item.status)}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-ink-faint transition ${open ? "rotate-180" : ""}`} />
                    </span>
                  </button>
                  {open ? (
                    <div className="grid gap-1.5 border-t border-black/5 px-3 py-2.5 text-[12px] text-ink-soft">
                      <p><span className="font-semibold text-ink">จุดรับ</span> / {item.pickup}</p>
                      <p><span className="font-semibold text-ink">จุดส่ง</span> / {item.dropoff}</p>
                      <p><span className="font-semibold text-ink">เวลา</span> / {jobTimeLabel(item.startTime, item.endTime)}</p>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {showComms ? <DriverChatThread messages={messages} notifications={notifications} onSend={sendMessage} sending={isPending} /> : null}

      {showComms ? <div className="grid grid-cols-2 gap-2">
        {coordinatorPhone ? (
          <a
            href={telHref(coordinatorPhone) ?? "#"}
            className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[1rem] bg-operation px-2 text-[12px] font-bold text-white shadow-sm transition active:scale-[0.99]"
          >
            <Phone className="h-4 w-4" /> โทรศูนย์ควบคุม
          </a>
        ) : (
          <span className="flex min-h-12 items-center justify-center rounded-command border border-border bg-white px-2 text-[11px] text-ink-faint">
            ยังไม่มีเบอร์
          </span>
        )}
        <button
          type="button"
          onClick={() => setIssueOpen((value) => !value)}
          className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[1rem] border border-amber-300 bg-amber-50 px-2 text-[12px] font-bold text-amber-800 shadow-sm transition active:scale-[0.99]"
        >
          <TriangleAlert className="h-4 w-4" /> แจ้งเหตุขัดข้อง
        </button>
      </div> : null}

      {showComms && issueOpen ? (
        <section className="smart-card grid gap-2">
          <p className="text-[13px] font-semibold text-ink">เลือกประเภทเหตุขัดข้อง</p>
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

      {!insideNativeShell ? (
        <nav
          aria-label="เมนูหน้าคนขับสำหรับทดสอบผ่านเว็บ"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-white/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-16px_36px_rgba(16,32,51,0.12)] backdrop-blur"
        >
          <div className="mx-auto grid max-w-[520px] grid-cols-4 gap-1.5">
            {WEB_DRIVER_TABS.map((item) => {
              const Icon = item.icon;
              const active = view === item.view;
              const unread = item.view === "messages" && notifications.some((notification) => notification.status === "unread");
              return (
                <Link
                  key={item.view}
                  href={`/ground-transfer/driver?token=${encodeURIComponent(driverAccess.token)}&view=${item.view}`}
                  className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1rem] px-1 text-[11px] font-bold transition active:scale-[0.98] ${
                    active
                      ? "bg-operation text-white shadow-[0_8px_18px_rgba(8,123,115,0.22)]"
                      : "text-ink-soft hover:bg-canvas"
                  }`}
                  aria-current={active ? "page" : undefined}
                  title={`เปิดหน้า${item.label}`}
                >
                  {unread ? <span className="absolute right-3 top-2 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" /> : null}
                  <Icon className="h-4 w-4" />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
          <p className="mx-auto mt-1 max-w-[520px] text-center text-[10px] font-semibold text-ink-faint">
            เมนูนี้แสดงเฉพาะเมื่อเปิดหน้าคนขับผ่านเว็บเบราว์เซอร์ เพื่อใช้ตรวจสอบแต่ละหน้าก่อนทดสอบบนแอป
          </p>
        </nav>
      ) : null}
    </div>
  );
}
