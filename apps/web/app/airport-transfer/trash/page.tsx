import { Trash2 } from "lucide-react";
import { RestoreAirportTransferCaseButton } from "@/components/airport-transfer/restore-case-button";
import { ButtonLink } from "@/components/ui/button";
import { getDeletedAirportTransferCases } from "@/lib/airport-transfer/data";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

export default async function AirportTransferTrashPage() {
  const cases = await getDeletedAirportTransferCases();
  return (
    <>
      <header><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">Recycle Bin</p><h1 className="mt-1 text-2xl font-semibold">ข้อมูลที่ลบแล้ว</h1><p className="mt-2 text-sm text-slate-500">ข้อมูล ประวัติการแก้ไข และ Snapshot เที่ยวบินยังคงอยู่ สามารถกู้คืนกลับเข้าสู่รายการงานได้</p></header>
      <section className="grid gap-3">
        {cases.length ? cases.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700"><Trash2 className="h-5 w-5" /></span><div><p className="text-xs font-bold text-cyan-800">{item.caseCode}</p><h2 className="mt-1 font-semibold">{item.passengerName} · {item.flightNumber}</h2><p className="mt-1 text-xs text-slate-500">ลบเมื่อ {formatDateTime(item.deletedAt)}{item.deleteReason ? ` · ${item.deleteReason}` : ""}</p></div></div>
              <div className="flex items-start gap-2"><ButtonLink href={`/airport-transfer/cases/${item.id}`} variant="quiet">ดูประวัติ</ButtonLink><RestoreAirportTransferCaseButton caseId={item.id} /></div>
            </div>
          </article>
        )) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-sm text-slate-500">ยังไม่มีข้อมูลที่ลบแล้ว</div>}
      </section>
    </>
  );
}
