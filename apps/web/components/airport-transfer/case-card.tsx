import { AlertTriangle, ArrowRight, CalendarClock, Check, ChevronDown, Circle, Clock3, Luggage, MapPin, Pencil, Phone, PlaneLanding, PlaneTakeoff, UsersRound } from "lucide-react";
import { completeAirportTransferTask } from "@/app/airport-transfer/actions";
import { operationalStatusLabel, verificationStatusLabel } from "@/lib/airport-transfer/labels";
import type { AirportTransferCase, AirportTransferFlightSnapshot, AirportTransferTask } from "@/lib/airport-transfer/types";
import { Button, ButtonLink } from "@/components/ui/button";

function formatDateTime(value: string | null) {
  if (!value) return "ยังไม่กำหนด";
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function minutesUntil(value: string | null) {
  if (!value) return null;
  const minutes = Math.ceil((new Date(value).getTime() - Date.now()) / 60_000);
  return Number.isFinite(minutes) ? minutes : null;
}

function minutesBetween(first: string | null, second: string | null) {
  if (!first || !second) return null;
  const value = Math.round((new Date(second).getTime() - new Date(first).getTime()) / 60_000);
  return Number.isFinite(value) ? value : null;
}

const flightStatusLabels: Record<string, string> = {
  scheduled: "ตามตาราง (Scheduled)",
  on_time: "ตรงเวลา (On Time)",
  active: "กำลังบิน (In Air)",
  en_route: "กำลังบิน (In Air)",
  boarding: "กำลังขึ้นเครื่อง (Boarding)",
  landed: "ถึงแล้ว (Landed)",
  arrived: "ถึงแล้ว (Landed)",
  delayed: "ล่าช้า (Delayed)",
  cancelled: "ยกเลิก (Cancelled)",
  diverted: "เปลี่ยนเส้นทาง (Diverted)"
};

function flightSummary(item: AirportTransferCase, snapshot?: AirportTransferFlightSnapshot) {
  if (!snapshot) return { label: verificationStatusLabel[item.verificationStatus], problem: !["verified", "manual_confirmed"].includes(item.verificationStatus), tone: "neutral" as const };
  const scheduled = item.direction === "arrival" ? snapshot.scheduledArrivalAt : snapshot.scheduledDepartureAt;
  const estimated = item.direction === "arrival" ? snapshot.estimatedArrivalAt : snapshot.estimatedDepartureAt;
  const delay = minutesBetween(scheduled, estimated);
  const providerStatus = (snapshot.providerStatus || "").toLowerCase().replaceAll(" ", "_");
  if (providerStatus === "cancelled") return { label: flightStatusLabels.cancelled, problem: true, tone: "danger" as const };
  if (providerStatus === "diverted") return { label: flightStatusLabels.diverted, problem: true, tone: "danger" as const };
  if (providerStatus === "delayed" || (delay !== null && delay > 5)) return { label: `ล่าช้า (Delayed)${delay !== null && delay > 0 ? ` · ${delay} นาที` : ""}`, problem: true, tone: "warning" as const };
  if (["landed", "arrived"].includes(providerStatus)) return { label: flightStatusLabels.landed, problem: false, tone: "success" as const };
  if (["active", "en_route"].includes(providerStatus)) return { label: flightStatusLabels.active, problem: false, tone: "active" as const };
  if (providerStatus === "boarding") return { label: flightStatusLabels.boarding, problem: false, tone: "active" as const };
  if (delay !== null && delay <= 5) return { label: flightStatusLabels.on_time, problem: false, tone: "success" as const };
  return { label: flightStatusLabels[providerStatus] || snapshot.providerStatus || "ตรวจสอบแล้ว", problem: false, tone: "neutral" as const };
}

export type OperationalAlert = { label: string; tone: "danger" | "warning" | "info"; score: number };

export function getAirportTransferOperationalAlerts(item: AirportTransferCase, tasks: AirportTransferTask[]): OperationalAlert[] {
  if (["completed", "cancelled"].includes(item.operationalStatus)) return [];
  const completedKeys = new Set(tasks.filter((task) => task.status === "completed").map((task) => task.taskKey));
  const alerts: OperationalAlert[] = [];
  const pickupAt = item.confirmedPickupAt || item.recommendedPickupAt;
  const pickupMinutes = minutesUntil(pickupAt);
  const passengerPickedUp = completedKeys.has("passenger_on_board") || ["passenger_on_board", "en_route", "arrived_destination"].includes(item.operationalStatus);

  if (pickupMinutes !== null && pickupMinutes < 0 && !passengerPickedUp) {
    alerts.push({ label: `เลยเวลารับ ${Math.abs(pickupMinutes)} นาที · ยังไม่รับผู้โดยสาร`, tone: "danger", score: 600 });
  } else if (pickupMinutes !== null && pickupMinutes <= 60 && !passengerPickedUp) {
    alerts.push({ label: `ถึงเวลารับใน ${Math.max(0, pickupMinutes)} นาที`, tone: pickupMinutes <= 30 ? "danger" : "warning", score: 450 });
  }

  if (item.direction === "departure") {
    const departureMinutes = minutesUntil(item.scheduledDepartureAt);
    const arrivedAirport = completedKeys.has("airport_arrived") || completedKeys.has("passenger_handed_over") || item.operationalStatus === "arrived_destination";
    if (departureMinutes !== null && departureMinutes < 0) {
      alerts.push({ label: `เครื่องออกแล้ว ${Math.abs(departureMinutes)} นาที · ยังไม่ปิดงาน`, tone: "danger", score: 700 });
    } else if (departureMinutes !== null && departureMinutes <= 60 && !arrivedAirport) {
      alerts.push({ label: `เหลือ ${Math.max(0, departureMinutes)} นาทีเครื่องออก · ยังไม่ถึงสนามบิน`, tone: "danger", score: 650 });
    } else if (departureMinutes !== null && departureMinutes <= 120 && !arrivedAirport) {
      alerts.push({ label: "ใกล้เวลาเครื่องออก · ยังไม่ถึงสนามบิน", tone: "warning", score: 500 });
    }
  } else {
    const arrivalMinutes = minutesUntil(item.scheduledArrivalAt);
    const passengerMet = completedKeys.has("passenger_met") || passengerPickedUp;
    if (arrivalMinutes !== null && arrivalMinutes < -15 && !passengerMet) {
      alerts.push({ label: `เครื่องถึงแล้ว ${Math.abs(arrivalMinutes)} นาที · ยังไม่พบผู้โดยสาร`, tone: "danger", score: 650 });
    }
  }

  if (!["verified", "manual_confirmed"].includes(item.verificationStatus)) alerts.push({ label: verificationStatusLabel[item.verificationStatus], tone: "warning", score: 400 });
  if (!item.vehicleType || !item.vehiclePlate || !item.driverName || !item.driverPhone) alerts.push({ label: "ข้อมูลรถหรือคนขับยังไม่ครบ", tone: "info", score: 300 });
  return alerts.sort((a, b) => b.score - a.score);
}

function nextAction(item: AirportTransferCase, tasks: AirportTransferTask[]) {
  const nextTask = tasks.find((task) => task.status === "pending");
  if (nextTask) return nextTask.label;
  if (item.operationalStatus === "completed") return "เสร็จสิ้น";
  if (item.operationalStatus === "cancelled") return "ยกเลิก";
  return "ตรวจรายละเอียด";
}

const alertTone = {
  danger: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-blue-200 bg-blue-50 text-blue-800"
};

const flightTone = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-800",
  active: "border-blue-200 bg-blue-50 text-blue-800",
  neutral: "border-slate-200 bg-slate-50 text-slate-700"
};

export function AirportTransferCaseCard({
  item,
  snapshot,
  tasks = [],
  projectCode,
  canManage = true,
  viewerRoleKey = null
}: {
  item: AirportTransferCase;
  snapshot?: AirportTransferFlightSnapshot;
  tasks?: AirportTransferTask[];
  projectCode: string;
  /**
   * Hides the edit link and the "เสร็จแล้ว" complete-task control. Defaults
   * to true so this component's two existing callers (the signed-in cases
   * pages, gated by getAirportTransferAccess at the layout level) render
   * exactly as before. The project-helper claim view
   * (components/project-helper/project-helper-view.tsx) is the one caller
   * that passes false, for viewer/coordinator-tier helper roles — completing
   * a task is already blocked server-side (completeAirportTransferTask
   * requires a signed-in session a helper never has), so this is about not
   * showing a management affordance to a role that was never meant to use
   * one, not a second enforcement layer.
   */
  canManage?: boolean;
  /**
   * The viewer's own airport_* role_key, used ONLY to decide whether to show
   * the "เสร็จแล้ว" button for a task that isn't owned by their role —
   * mirrors completeAirportTransferTask's own Layer 3 check
   * (task.owner_role must equal the caller's getAirportTransferProjectRole
   * result unless they canManage). Irrelevant when canManage is true.
   * Undefined (the two existing callers, which never pass it) preserves
   * prior behaviour exactly: the button shows for every current task,
   * because canManage already defaults to true for them.
   */
  viewerRoleKey?: string | null;
}) {
  const DirectionIcon = item.direction === "arrival" ? PlaneLanding : PlaneTakeoff;
  const pickupAt = item.confirmedPickupAt || item.recommendedPickupAt;
  const flight = flightSummary(item, snapshot);
  const completedTasks = tasks.filter((task) => task.status === "completed").length;
  const alerts = getAirportTransferOperationalAlerts(item, tasks);
  const isCompleted = item.operationalStatus === "completed";
  const currentTaskIndex = tasks.findIndex((task) => task.status === "pending");

  return (
    <details className={`group rounded-xl border bg-white shadow-sm ${alerts.some((alert) => alert.tone === "danger") ? "border-red-300" : alerts.length ? "border-amber-300" : isCompleted ? "border-emerald-200 bg-emerald-50/20" : "border-slate-200"}`}>
      <summary className="cursor-pointer list-none px-3 py-3 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-cyan-50 text-cyan-800"}`}><DirectionIcon className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="truncate font-semibold text-slate-950">{item.passengerName}</p><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{item.caseCode}</span></div><p className="truncate text-xs text-slate-500">{item.clientName || "ไม่ระบุลูกค้า"} · {item.passengerCount} คน · {item.luggageCount} กระเป๋า</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className={`rounded-full px-2 py-1 font-bold ${isCompleted ? "bg-emerald-600 text-white" : "bg-cyan-100 text-cyan-900"}`}>{operationalStatusLabel[item.operationalStatus]}</span>
            {!isCompleted ? <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-800">ถัดไป: {nextAction(item, tasks)}</span> : null}
            <span className="inline-flex items-center gap-1 font-semibold text-cyan-800">รายละเอียด <ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></span>
          </div>
        </div>

        <div className="mt-2 grid gap-2 border-t border-slate-100 pt-2 text-xs md:grid-cols-2 xl:grid-cols-4">
          <div><span className="text-slate-500">เที่ยวบิน / สถานะการบิน</span><div className="mt-1 flex flex-wrap items-center gap-1.5"><strong className="text-sm text-slate-950">{item.flightNumber}</strong><span className={`rounded-lg border px-2 py-1 font-bold ${flightTone[flight.tone]}`}>{flight.label}</span></div></div>
          <div><span className="text-slate-500">เส้นทางเครื่องบิน / เวลา</span><div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2"><div><p className="font-bold text-slate-900">{item.originAirport || "—"}</p><p className="text-[11px] text-slate-500">ออก {formatDateTime(item.scheduledDepartureAt)}</p></div><ArrowRight className="h-3.5 w-3.5 text-slate-300" /><div><p className="font-bold text-slate-900">{item.destinationAirport || "—"}</p><p className="text-[11px] text-slate-500">ถึง {formatDateTime(item.scheduledArrivalAt)}</p></div></div></div>
          <div><span className="text-slate-500">เส้นทางรถ / เวลารับ</span><p className="font-bold text-slate-900">{item.pickupName} → {item.dropoffName}</p><p className="text-slate-500">รับ {formatDateTime(pickupAt)}</p></div>
          <div><span className="text-slate-500">รถ / คนขับ</span><p className="font-bold text-slate-900">{item.vehicleType || "ยังไม่จัดรถ"} · {item.vehiclePlate || "ไม่มีทะเบียน"}</p><p className="text-slate-600">{item.driverName || "ยังไม่จัดคนขับ"} · {item.driverPhone || "ไม่มีเบอร์"}</p></div>
        </div>

        {alerts.length ? <div className="mt-2 flex flex-wrap gap-1.5">{alerts.slice(0, 3).map((alert) => <span key={alert.label} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold ${alertTone[alert.tone]}`}><AlertTriangle className="h-3.5 w-3.5" />{alert.label}</span>)}</div> : null}
      </summary>

      <div className="grid border-t border-slate-100 lg:grid-cols-2">
        <section className="grid content-start gap-3 p-3 text-xs lg:border-r lg:border-slate-100">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex gap-2"><CalendarClock className="mt-0.5 h-4 w-4 text-cyan-700" /><div><p className="font-bold">เวลาเที่ยวบิน</p><p className="text-slate-600">ออก {formatDateTime(item.scheduledDepartureAt)}</p><p className="text-slate-600">ถึง {formatDateTime(item.scheduledArrivalAt)}</p></div></div>
            <div className="flex gap-2"><Clock3 className="mt-0.5 h-4 w-4 text-cyan-700" /><div><p className="font-bold">ข้อมูลล่าสุด</p><p className="text-slate-600">Flight API {snapshot ? formatDateTime(snapshot.observedAt) : "ยังไม่มีข้อมูล"}</p><p className="text-slate-600">แก้ไข {formatDateTime(item.updatedAt)}</p></div></div>
            <div className="flex gap-2"><UsersRound className="mt-0.5 h-4 w-4 text-cyan-700" /><div><p className="font-bold">ผู้โดยสาร</p><p className="text-slate-600">{item.passengerCount} คน {item.fastTrack ? "· Fast Track" : ""}</p>{item.passengerMobile ? <p className="text-slate-600">{item.passengerMobile}</p> : null}</div></div>
            <div className="flex gap-2"><Luggage className="mt-0.5 h-4 w-4 text-cyan-700" /><div><p className="font-bold">สัมภาระ / หมายเหตุ</p><p className="text-slate-600">{item.luggageCount} กระเป๋า</p><p className="line-clamp-2 text-slate-600">{item.notes || "ไม่มีหมายเหตุ"}</p></div></div>
          </div>
          <div className="flex items-center justify-between gap-6 border-t border-slate-100 pt-3"><div className="flex flex-wrap gap-1.5">{item.driverPhone ? <a href={`tel:${item.driverPhone}`} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 font-semibold text-cyan-800"><Phone className="h-3.5 w-3.5" />โทรหาคนขับ</a> : null}{item.pickupMapsUrl ? <a href={item.pickupMapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 font-semibold text-cyan-800"><MapPin className="h-3.5 w-3.5" />แผนที่จุดรับ</a> : null}</div>{!item.deletedAt && canManage ? <ButtonLink href={`/projects/${projectCode}/airport-transfer/cases/${item.id}/edit`} variant="secondary" className="!min-h-8 shrink-0 gap-1.5 border-cyan-200 px-3 py-1 text-xs text-cyan-800"><Pencil className="h-3.5 w-3.5" />แก้ไขข้อมูล</ButtonLink> : null}</div>
        </section>

        <section className="p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs"><strong>Checklist การปฏิบัติงาน</strong><span className="font-semibold text-slate-500">{completedTasks}/{tasks.length}</span></div>
          <div className="grid gap-1.5 sm:grid-cols-2">{tasks.map((task, index) => { const completed = task.status === "completed"; const isCurrent = index === currentTaskIndex; const action = completeAirportTransferTask.bind(null, item.id, task.id); const mayComplete = canManage || task.ownerRole === viewerRoleKey; return <div key={task.id} className={`flex h-9 items-center gap-2 rounded-lg border px-2 ${completed ? "border-emerald-200 bg-emerald-50 text-emerald-900" : isCurrent ? "border-cyan-400 bg-cyan-50 ring-1 ring-cyan-200" : "border-slate-200 bg-slate-50 text-slate-500"}`}><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${completed ? "bg-emerald-600 text-white" : isCurrent ? "bg-cyan-700 text-white" : "bg-slate-200 text-slate-600"}`}>{completed ? <Check className="h-3 w-3" /> : task.sequence || index + 1}</span><span className="min-w-0 flex-1 text-[11px] font-semibold leading-4">{task.label}</span>{!completed && isCurrent && !item.deletedAt && item.operationalStatus !== "cancelled" && mayComplete ? <form action={action} className="shrink-0"><Button type="submit" variant="secondary" className="h-7 !min-h-7 px-2 py-0 text-[10px]">เสร็จแล้ว</Button></form> : null}</div>; })}</div>
          {!tasks.length ? <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500"><Circle className="mx-auto mb-1 h-4 w-4" />ยังไม่มีเช็กลิสต์</div> : null}
        </section>
      </div>
    </details>
  );
}
