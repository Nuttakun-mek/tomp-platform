import { AlertTriangle, CarFront, CheckCircle2, ClipboardList, Clock3, Plus, ShieldCheck } from "lucide-react";
import { AirportTransferCaseCard } from "@/components/airport-transfer/case-card";
import { AirportTransferApiHealthCard } from "@/components/airport-transfer/api-health-card";
import { ButtonLink } from "@/components/ui/button";
import { getAirportTransferApiHealth, getAirportTransferCases, getAirportTransferTasksByCaseIds, getLatestAirportTransferFlightSnapshots, summarizeAirportTransferCases } from "@/lib/airport-transfer/data";

export default async function AirportTransferDashboardPage() {
  const [cases, apiHealth] = await Promise.all([getAirportTransferCases(), getAirportTransferApiHealth()]);
  const now = Date.now();
  const activeCases = cases.filter((item) => !["completed", "cancelled"].includes(item.operationalStatus));
  const minutesToPickup = (item: (typeof cases)[number]) => {
    const value = item.confirmedPickupAt || item.recommendedPickupAt;
    return value ? (new Date(value).getTime() - now) / 60_000 : Number.POSITIVE_INFINITY;
  };
  const verificationProblem = (item: (typeof cases)[number]) => !["verified", "manual_confirmed"].includes(item.verificationStatus);
  const priority = (item: (typeof cases)[number]) => {
    const minutes = minutesToPickup(item);
    if (minutes < 0) return 500;
    if (minutes <= 30) return 450;
    if (verificationProblem(item)) return 400;
    if (!item.driverName || !item.vehiclePlate) return 350;
    if (minutes <= 120) return 300;
    if (minutes <= 360) return 200;
    return 100;
  };
  const visibleCases = [...activeCases].sort((a, b) => priority(b) - priority(a) || minutesToPickup(a) - minutesToPickup(b)).slice(0, 10);
  const visibleCaseIds = visibleCases.map((item) => item.id);
  const [snapshots, tasks] = await Promise.all([getLatestAirportTransferFlightSnapshots(visibleCaseIds), getAirportTransferTasksByCaseIds(visibleCaseIds)]);
  const alerts = {
    overdue: activeCases.filter((item) => minutesToPickup(item) < 0).length,
    nextTwoHours: activeCases.filter((item) => minutesToPickup(item) >= 0 && minutesToPickup(item) <= 120).length,
    flightIssues: activeCases.filter(verificationProblem).length,
    unassigned: activeCases.filter((item) => !item.driverName || !item.vehiclePlate).length
  };
  const summary = summarizeAirportTransferCases(cases);
  const metrics = [
    { label: "เคสทั้งหมด", value: summary.total, icon: ClipboardList, color: "text-slate-700 bg-slate-100" },
    { label: "ต้องดำเนินการ", value: summary.actionRequired, icon: AlertTriangle, color: "text-amber-800 bg-amber-50" },
    { label: "ยังไม่ได้จัดรถ", value: summary.unassigned, icon: CarFront, color: "text-blue-800 bg-blue-50" },
    { label: "เที่ยวบินมีประเด็น", value: summary.verificationIssues, icon: ShieldCheck, color: "text-red-800 bg-red-50" },
    { label: "เสร็จสิ้น", value: summary.completed, icon: CheckCircle2, color: "text-emerald-800 bg-emerald-50" }
  ];

  return (
    <>
      <section className="overflow-hidden rounded-2xl bg-[#0b2d46] p-4 text-white shadow-lg lg:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Operations Control Center</p><h1 className="mt-2 text-2xl font-semibold lg:text-3xl">ศูนย์ควบคุม Airport Transfer</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">เรียงงานตามเวลาที่ต้องดำเนินการ ตรวจเที่ยวบิน จัดรถ และติดตามการรับ–ส่งผู้โดยสารจากจุดเดียว</p></div>
          <ButtonLink href="/airport-transfer/cases/new" className="gap-2 bg-cyan-300 text-cyan-950 hover:bg-cyan-200"><Plus className="h-4 w-4" />สร้างการ์ดข้อมูล</ButtonLink>
        </div>
      </section>
      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(({ label, value, icon: Icon, color }) => <article key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${color}`}><Icon className="h-4 w-4" /></div><div><p className="text-xl font-semibold leading-none tabular-nums">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div></article>)}
      </section>
      <AirportTransferApiHealthCard health={apiHealth} />
      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "เลยเวลารับ", value: alerts.overdue, icon: AlertTriangle, color: alerts.overdue ? "border-red-300 bg-red-50 text-red-800" : "border-slate-200 bg-white text-slate-500" },
          { label: "ภายใน 2 ชั่วโมง", value: alerts.nextTwoHours, icon: Clock3, color: alerts.nextTwoHours ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-500" },
          { label: "เที่ยวบินต้องตรวจ", value: alerts.flightIssues, icon: ShieldCheck, color: alerts.flightIssues ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-500" },
          { label: "ยังไม่พร้อมรถ/คนขับ", value: alerts.unassigned, icon: CarFront, color: alerts.unassigned ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-500" }
        ].map(({ label, value, icon: Icon, color }) => <div key={label} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${color}`}><Icon className="h-4 w-4" /><strong className="text-lg tabular-nums">{value}</strong><span>{label}</span></div>)}
      </section>
      <section className="grid gap-3">
        <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">Priority Queue</p><h2 className="mt-1 text-xl font-semibold">งานเร่งด่วนและสิ่งที่ต้องทำ</h2><p className="text-xs text-slate-500">เรียงจากงานเลยเวลา งานใกล้ถึง และงานข้อมูลไม่พร้อม</p></div><ButtonLink href="/airport-transfer/cases" variant="secondary">ดูทั้งหมด</ButtonLink></div>
        {visibleCases.length ? visibleCases.map((item) => <AirportTransferCaseCard key={item.id} item={item} snapshot={snapshots[item.id]} tasks={tasks[item.id]} />) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center"><p className="font-semibold">ยังไม่มีข้อมูลการเดินทาง</p><p className="mt-1 text-sm text-slate-500">สร้างการ์ดแรกหรือนำเข้าข้อมูลจาก Excel</p></div>}
      </section>
    </>
  );
}
