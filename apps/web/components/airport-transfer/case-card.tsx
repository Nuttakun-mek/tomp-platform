import { AlertTriangle, CalendarClock, CarFront, Check, ChevronDown, Circle, MapPin, Phone, PlaneLanding, PlaneTakeoff, UserRound } from "lucide-react";
import { completeAirportTransferTask } from "@/app/airport-transfer/actions";
import { operationalStatusLabel, verificationStatusLabel } from "@/lib/airport-transfer/labels";
import type { AirportTransferCase, AirportTransferFlightSnapshot, AirportTransferTask } from "@/lib/airport-transfer/types";
import { Button, ButtonLink } from "@/components/ui/button";

function formatDateTime(value: string | null) {
  if (!value) return "ยังไม่กำหนด";
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function minutesBetween(first: string | null, second: string | null) {
  if (!first || !second) return null;
  const value = Math.round((new Date(second).getTime() - new Date(first).getTime()) / 60_000);
  return Number.isFinite(value) ? value : null;
}

function urgency(pickupAt: string | null, pickupFinished: boolean) {
  if (!pickupAt || pickupFinished) return null;
  const minutes = Math.ceil((new Date(pickupAt).getTime() - Date.now()) / 60_000);
  if (minutes < 0) return { label: `เลยเวลารับ ${Math.abs(minutes)} นาที`, color: "bg-red-600 text-white", urgent: true };
  if (minutes <= 30) return { label: `เหลือ ${minutes} นาที`, color: "bg-red-50 text-red-800 ring-1 ring-red-200", urgent: true };
  if (minutes <= 120) return { label: `ใกล้ถึงเวลา ${Math.floor(minutes / 60)} ชม. ${minutes % 60} นาที`, color: "bg-amber-50 text-amber-800 ring-1 ring-amber-200", urgent: true };
  if (minutes <= 360) return { label: `อีก ${Math.ceil(minutes / 60)} ชั่วโมง`, color: "bg-blue-50 text-blue-800", urgent: false };
  return null;
}

const flightStatusLabels: Record<string, string> = {
  scheduled: "ตามตาราง", active: "กำลังบิน", landed: "ถึงแล้ว", delayed: "ล่าช้า", cancelled: "ยกเลิก", diverted: "เปลี่ยนเส้นทาง"
};

function flightSummary(item: AirportTransferCase, snapshot?: AirportTransferFlightSnapshot) {
  if (!snapshot) return { label: verificationStatusLabel[item.verificationStatus], problem: !["verified", "manual_confirmed"].includes(item.verificationStatus) };
  const scheduled = item.direction === "arrival" ? snapshot.scheduledArrivalAt : snapshot.scheduledDepartureAt;
  const estimated = item.direction === "arrival" ? snapshot.estimatedArrivalAt : snapshot.estimatedDepartureAt;
  const delay = minutesBetween(scheduled, estimated);
  const base = flightStatusLabels[snapshot.providerStatus || ""] || snapshot.providerStatus || "ตรวจแล้ว";
  if (delay !== null && delay > 5) return { label: `${base} · ช้า ${delay} นาที`, problem: true };
  return { label: `${base}${delay !== null ? " · ตรงเวลา" : ""}`, problem: ["delayed", "cancelled", "diverted"].includes(snapshot.providerStatus || "") };
}

function nextAction(item: AirportTransferCase) {
  if (!["verified", "manual_confirmed"].includes(item.verificationStatus)) return "ตรวจสอบเที่ยวบิน";
  if (!item.vehicleType || !item.vehiclePlate) return "จัดรถ";
  if (!item.driverName || !item.driverPhone) return "จัดคนขับ";
  if (["verified", "ready_to_assign", "assigned"].includes(item.operationalStatus)) return "แจ้งและยืนยันคนขับ";
  if (["driver_notified", "driver_confirmed"].includes(item.operationalStatus)) return "ติดตามรถไปจุดรับ";
  if (["vehicle_en_route", "vehicle_arrived"].includes(item.operationalStatus)) return "ติดตามการรับผู้โดยสาร";
  if (["passenger_met", "passenger_on_board", "en_route"].includes(item.operationalStatus)) return "ติดตามจนถึงปลายทาง";
  return "ตรวจรายละเอียด";
}

const pickupFinishedStatuses = new Set(["passenger_met", "passenger_on_board", "en_route", "arrived_destination", "completed", "cancelled"]);

export function AirportTransferCaseCard({ item, snapshot, tasks = [] }: { item: AirportTransferCase; snapshot?: AirportTransferFlightSnapshot; tasks?: AirportTransferTask[] }) {
  const DirectionIcon = item.direction === "arrival" ? PlaneLanding : PlaneTakeoff;
  const pickupAt = item.confirmedPickupAt || item.recommendedPickupAt;
  const timeAlert = urgency(pickupAt, pickupFinishedStatuses.has(item.operationalStatus));
  const flight = flightSummary(item, snapshot);
  const completedTasks = tasks.filter((task) => task.status === "completed").length;

  return (
    <details className={`group rounded-xl border bg-white shadow-sm ${timeAlert?.urgent ? "border-amber-300" : "border-slate-200"}`}>
      <summary className="flex cursor-pointer list-none flex-col gap-2 px-3 py-3 xl:flex-row xl:items-center [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-800"><DirectionIcon className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="truncate font-semibold text-slate-950">{item.passengerName}</p><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{item.caseCode}</span></div>
            <p className="truncate text-xs text-slate-500"><strong>{item.flightNumber}</strong> · {item.originAirport || "—"} → {item.destinationAirport || "—"} · {item.pickupName} → {item.dropoffName}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-slate-900 px-2 py-1 font-semibold text-white">ถัดไป: {nextAction(item)}</span>
          {timeAlert ? <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-bold ${timeAlert.color}`}><AlertTriangle className="h-3.5 w-3.5" />{timeAlert.label}</span> : null}
          <span className="rounded-full bg-cyan-50 px-2 py-1 font-semibold text-cyan-800">{operationalStatusLabel[item.operationalStatus]}</span>
          <span className="font-semibold text-slate-700">รับ {formatDateTime(pickupAt)}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-cyan-800">รายละเอียด <ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></span>
        </div>
      </summary>

      <div className="border-t border-slate-100 px-3 py-3">
        <div className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-slate-400" /><span><strong>เที่ยวบิน {flight.label}</strong><span className="block text-slate-500">บิน {formatDateTime(item.direction === "arrival" ? item.scheduledArrivalAt : item.scheduledDepartureAt)} · อัปเดต {snapshot ? formatDateTime(snapshot.observedAt) : "—"}</span></span></div>
          <div className="flex items-center gap-1.5"><CarFront className="h-3.5 w-3.5 text-slate-400" /><span><strong>{item.vehicleType || "ยังไม่จัดรถ"}</strong> · {item.vehiclePlate || "ไม่มีทะเบียน"}</span></div>
          <div className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5 text-slate-400" /><span><strong>{item.driverName || "ยังไม่จัดคนขับ"}</strong> · {item.driverPhone || "ไม่มีเบอร์"}</span></div>
          <div className="flex flex-wrap items-center justify-end gap-1">{item.driverPhone ? <a href={`tel:${item.driverPhone}`} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-cyan-800"><Phone className="h-3.5 w-3.5" /></a> : null}{item.pickupMapsUrl ? <a href={item.pickupMapsUrl} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-cyan-800"><MapPin className="h-3.5 w-3.5" /></a> : null}<ButtonLink href={`/airport-transfer/cases/${item.id}`} variant="secondary" className="min-h-8 px-2 py-1 text-xs">เปิดเคส</ButtonLink></div>
        </div>

        {tasks.length ? <div className="mt-3 border-t border-slate-100 pt-3"><div className="mb-2 flex items-center justify-between text-xs"><strong>Checklist การปฏิบัติงาน</strong><span className="text-slate-500">{completedTasks}/{tasks.length} · ทำตามลำดับ</span></div><div className="grid gap-1.5 md:grid-cols-2">{tasks.map((task, index) => { const completed = task.status === "completed"; const canComplete = tasks.slice(0, index).every((earlier) => earlier.status !== "pending"); const action = completeAirportTransferTask.bind(null, item.id, task.id); return <div key={task.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${completed ? "border-emerald-200 bg-emerald-50" : canComplete ? "border-cyan-300 bg-cyan-50/40" : "border-slate-200"}`}><span className={completed ? "text-emerald-700" : "text-slate-400"}>{completed ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</span><span className="min-w-0 flex-1 truncate text-xs font-semibold">{task.label}</span>{!completed && canComplete && !item.deletedAt && item.operationalStatus !== "cancelled" ? <form action={action}><Button type="submit" variant="secondary" className="min-h-7 px-2 py-1 text-[11px]">เสร็จแล้ว</Button></form> : null}</div>; })}</div></div> : null}
      </div>
    </details>
  );
}
