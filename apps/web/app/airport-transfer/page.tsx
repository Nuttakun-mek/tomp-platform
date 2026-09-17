import { AlertTriangle, CarFront, CheckCircle2, ClipboardList, Plus, ShieldCheck } from "lucide-react";
import { AirportTransferCaseCard } from "@/components/airport-transfer/case-card";
import { ButtonLink } from "@/components/ui/button";
import { getAirportTransferCases, summarizeAirportTransferCases } from "@/lib/airport-transfer/data";

export default async function AirportTransferDashboardPage() {
  const cases = await getAirportTransferCases();
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
      <section className="overflow-hidden rounded-3xl bg-[#0b2d46] p-5 text-white shadow-xl lg:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Operations Control Center</p><h1 className="mt-2 text-2xl font-semibold lg:text-3xl">ศูนย์ควบคุม Airport Transfer</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">เรียงงานตามเวลาที่ต้องดำเนินการ ตรวจเที่ยวบิน จัดรถ และติดตามการรับ–ส่งผู้โดยสารจากจุดเดียว</p></div>
          <ButtonLink href="/airport-transfer/cases/new" className="gap-2 bg-cyan-300 text-cyan-950 hover:bg-cyan-200"><Plus className="h-4 w-4" />สร้างการ์ดข้อมูล</ButtonLink>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(({ label, value, icon: Icon, color }) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`grid h-9 w-9 place-items-center rounded-xl ${color}`}><Icon className="h-4 w-4" /></div><p className="mt-4 text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-sm text-slate-500">{label}</p></article>)}
      </section>
      <section className="grid gap-3">
        <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">Action Queue</p><h2 className="mt-1 text-xl font-semibold">งานตามลำดับที่ต้องจัดการ</h2></div><ButtonLink href="/airport-transfer/cases" variant="secondary">ดูทั้งหมด</ButtonLink></div>
        {cases.length ? cases.slice(0, 8).map((item) => <AirportTransferCaseCard key={item.id} item={item} />) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center"><p className="font-semibold">ยังไม่มีข้อมูลการเดินทาง</p><p className="mt-1 text-sm text-slate-500">สร้างการ์ดแรกหรือนำเข้าข้อมูลจาก Excel</p></div>}
      </section>
    </>
  );
}

