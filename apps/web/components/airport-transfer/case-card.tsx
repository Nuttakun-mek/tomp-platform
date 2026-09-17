import { CalendarClock, CarFront, MapPin, PlaneLanding, PlaneTakeoff, UserRound } from "lucide-react";
import { operationalStatusLabel, verificationStatusLabel } from "@/lib/airport-transfer/labels";
import type { AirportTransferCase } from "@/lib/airport-transfer/types";
import { ButtonLink } from "@/components/ui/button";

function formatDateTime(value: string | null) {
  if (!value) return "ยังไม่กำหนด";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

export function AirportTransferCaseCard({ item }: { item: AirportTransferCase }) {
  const DirectionIcon = item.direction === "arrival" ? PlaneLanding : PlaneTakeoff;
  const verificationProblem = !["verified", "manual_confirmed"].includes(item.verificationStatus);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-800"><DirectionIcon className="h-5 w-5" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-slate-950">{item.passengerName}</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{item.caseCode}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{item.clientName || "ไม่ระบุลูกค้า"} · {item.passengerCount} คน · {item.luggageCount} กระเป๋า</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${verificationProblem ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{verificationStatusLabel[item.verificationStatus]}</span>
          <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800">{operationalStatusLabel[item.operationalStatus]}</span>
        </div>
      </div>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
        <div className="flex gap-2"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span><strong className="block text-slate-800">{item.flightNumber}</strong><span className="text-slate-500">{item.originAirport || "—"} → {item.destinationAirport || "—"}</span></span></div>
        <div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span><strong className="block text-slate-800">{item.pickupName}</strong><span className="text-slate-500">ไป {item.dropoffName}</span></span></div>
        <div className="flex gap-2"><CarFront className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span><strong className="block text-slate-800">{item.vehicleType || "ยังไม่จัดรถ"}</strong><span className="text-slate-500">{item.vehiclePlate || "ไม่มีทะเบียนรถ"}</span></span></div>
        <div className="flex gap-2"><UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span><strong className="block text-slate-800">{item.driverName || "ยังไม่จัดคนขับ"}</strong><span className="text-slate-500">รับ: {formatDateTime(item.confirmedPickupAt || item.recommendedPickupAt)}</span></span></div>
      </div>
      <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
        <ButtonLink href={`/airport-transfer/cases/${item.id}`} variant="secondary">เปิดเคสและ Checklist</ButtonLink>
      </div>
    </article>
  );
}
