import { AirportTransferCaseCard } from "@/components/airport-transfer/case-card";
import { ButtonLink } from "@/components/ui/button";
import { getAirportTransferCases } from "@/lib/airport-transfer/data";

interface CasesPageProps { searchParams?: Promise<{ direction?: string; status?: string; q?: string; created?: string }> }

export default async function AirportTransferCasesPage({ searchParams }: CasesPageProps) {
  const params = searchParams ? await searchParams : {};
  const cases = await getAirportTransferCases({ direction: params.direction, status: params.status, query: params.q });
  return (
    <>
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">Travel Cases</p><h1 className="mt-1 text-2xl font-semibold">ข้อมูลการเดินทางทั้งหมด</h1><p className="mt-2 text-sm text-slate-500">ค้นหาและกรองตามทิศทาง สถานะ และข้อมูลผู้โดยสาร</p></div><ButtonLink href="/airport-transfer/cases/new">สร้างการ์ดข้อมูล</ButtonLink></header>
      {params.created ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">สร้างเคส {params.created} เรียบร้อยแล้ว</div> : null}
      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_180px_200px_auto]" method="get">
        <input name="q" defaultValue={params.q} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" placeholder="ค้นหา Case ID, เที่ยวบิน หรือชื่อ" />
        <select name="direction" defaultValue={params.direction || ""} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="">ทุกประเภท</option><option value="arrival">รับเข้า</option><option value="departure">ส่งออก</option></select>
        <select name="status" defaultValue={params.status || ""} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="">ทุกสถานะ</option><option value="needs_review">รอตรวจสอบ</option><option value="ready_to_assign">พร้อมจัดรถ</option><option value="assigned">จัดรถแล้ว</option><option value="completed">เสร็จสิ้น</option><option value="issue">มีปัญหา</option></select>
        <button className="rounded-xl bg-cyan-800 px-4 py-2.5 text-sm font-semibold text-white">ค้นหา</button>
      </form>
      <section className="grid gap-3">{cases.length ? cases.map((item) => <AirportTransferCaseCard key={item.id} item={item} />) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-sm text-slate-500">ไม่พบข้อมูลตามเงื่อนไข</div>}</section>
    </>
  );
}

