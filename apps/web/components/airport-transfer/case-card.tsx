import { AlertTriangle, CalendarClock, CarFront, Clock3, MapPin, PlaneLanding, PlaneTakeoff, UserRound } from "lucide-react";
import { operationalStatusLabel, verificationStatusLabel } from "@/lib/airport-transfer/labels";
import type { AirportTransferCase, AirportTransferFlightSnapshot } from "@/lib/airport-transfer/types";
import { ButtonLink } from "@/components/ui/button";

function formatDateTime(value: string | null) {
  if (!value) return "ยังไม่กำหนด";
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function minutesBetween(first: string | null, second: string | null) {
  if (!first || !second) return null;
  const value = Math.round((new Date(second).getTime() - new Date(first).getTime()) / 60_000);
  return Number.isFinite(value) ? value : null;
}

function urgency(pickupAt: string | null, completed: boolean) {
  if (!pickupAt || completed) return null;
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

export function AirportTransferCaseCard({ item, snapshot }: { item: AirportTransferCase; snapshot?: AirportTransferFlightSnapshot }) {
  const DirectionIcon = item.direction === "arrival" ? PlaneLanding : PlaneTakeoff;
  const pickupAt = item.confirmedPickupAt || item.recommendedPickupAt;
  const timeAlert = urgency(pickupAt, ["completed", "cancelled"].includes(item.operationalStatus));
  const flight = flightSummary(item, snapshot);

  return (
    <article className={`rounded-xl border bg-white px-3 py-3 shadow-sm ${timeAlert?.urgent ? "border-amber-300" : "border-slate-200"}`}>
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-800"><DirectionIcon className="h-4 w-4" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="truncate font-semibold text-slate-950">{item.passengerName}</p><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{item.caseCode}</span></div>
            <p className="truncate text-xs text-slate-500">{item.clientName || "ไม่ระบุลูกค้า"} · {item.passengerCount} คน · {item.luggageCount} กระเป๋า</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {timeAlert ? <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-bold ${timeAlert.color}`}>{timeAlert.urgent ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}{timeAlert.label}</span> : null}
          <span className={`rounded-full px-2 py-1 font-semibold ${flight.problem ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>เที่ยวบิน: {flight.label}</span>
          <span className="rounded-full bg-cyan-50 px-2 py-1 font-semibold text-cyan-800">{operationalStatusLabel[item.operationalStatus]}</span>
        </div>
      </div>
      <div className="mt-2 grid gap-x-4 gap-y-2 border-t border-slate-100 pt-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span><strong>{item.flightNumber}</strong> · {item.originAirport || "—"} → {item.destinationAirport || "—"}</span></div>
        <div className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span><strong>รับ {formatDateTime(pickupAt)}</strong><span className="block text-slate-500">บิน {formatDateTime(item.direction === "arrival" ? item.scheduledArrivalAt : item.scheduledDepartureAt)}</span></span></div>
        <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate"><strong>{item.pickupName}</strong> → {item.dropoffName}</span></div>
        <div className="flex items-center gap-1.5"><CarFront className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span><strong>{item.vehicleType || "ยังไม่จัดรถ"}</strong> · {item.vehiclePlate || "ไม่มีทะเบียน"}</span></div>
        <div className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-1.5"><UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate"><strong>{item.driverName || "ยังไม่จัดคนขับ"}</strong>{snapshot ? <span className="block text-[10px] text-slate-400">อัปเดต {formatDateTime(snapshot.observedAt)}</span> : null}</span></span><ButtonLink href={`/airport-transfer/cases/${item.id}`} variant="secondary" className="min-h-8 shrink-0 px-2 py-1 text-xs">เปิดเคส</ButtonLink></div>
      </div>
    </article>
  );
}
