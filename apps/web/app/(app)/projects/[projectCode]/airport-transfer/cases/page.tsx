import { notFound } from "next/navigation";
import { AirportTransferCaseCard } from "@/components/airport-transfer/case-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getAirportTransferCases, getAirportTransferTasksByCaseIds, getLatestAirportTransferFlightSnapshots } from "@/lib/airport-transfer/data";
import { getProjectByCode } from "@/lib/data/projects";

interface CasesPageProps {
  params: Promise<{ projectCode: string }>;
  searchParams?: Promise<{ direction?: string; status?: string; q?: string; created?: string; trashed?: string }>;
}

export default async function AirportTransferCasesPage({ params, searchParams }: CasesPageProps) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();
  const query = searchParams ? await searchParams : {};
  const cases = await getAirportTransferCases({ projectId: project.id, direction: query.direction, status: query.status, query: query.q });
  const caseIds = cases.map((item) => item.id);
  const [snapshots, tasks] = await Promise.all([getLatestAirportTransferFlightSnapshots(caseIds), getAirportTransferTasksByCaseIds(caseIds)]);
  const currentCases = cases.filter((item) => !["completed", "cancelled"].includes(item.operationalStatus));
  const completedCases = cases.filter((item) => item.operationalStatus === "completed");
  const cancelledCases = cases.filter((item) => item.operationalStatus === "cancelled");
  return (
    <>
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">Travel Cases</p><h1 className="mt-1 text-2xl font-semibold">ข้อมูลการเดินทางทั้งหมด</h1><p className="mt-2 text-sm text-slate-500">ค้นหาและกรองตามทิศทาง สถานะ และข้อมูลผู้โดยสาร</p></div><ButtonLink href={`/projects/${projectCode}/airport-transfer/cases/new`}>สร้างการ์ดข้อมูล</ButtonLink></header>
      {query.created ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">สร้างเคส {query.created} เรียบร้อยแล้ว</div> : null}
      {query.trashed ? <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">ย้ายเคสไปยัง “ข้อมูลที่ลบแล้ว” เรียบร้อย สามารถกู้คืนได้ภายหลัง</div> : null}
      <form className="grid items-stretch gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_180px_200px_88px]" method="get">
        <Input name="q" defaultValue={query.q} className="h-11 rounded-xl py-0" placeholder="ค้นหา Case ID, เที่ยวบิน หรือชื่อ" />
        <Select name="direction" defaultValue={query.direction || ""} className="h-11 rounded-xl py-0"><option value="">ทุกประเภท</option><option value="arrival">รับเข้า</option><option value="departure">ส่งออก</option></Select>
        <Select name="status" defaultValue={query.status || ""} className="h-11 rounded-xl py-0"><option value="">ทุกสถานะ</option><option value="needs_review">รอตรวจสอบ</option><option value="ready_to_assign">พร้อมจัดรถ</option><option value="assigned">จัดรถแล้ว</option><option value="completed">เสร็จสิ้น</option><option value="issue">มีปัญหา</option></Select>
        <Button type="submit" className="h-11 min-h-11 rounded-xl py-0">ค้นหา</Button>
      </form>
      {cases.length ? <>
        {currentCases.length ? <section className="grid gap-2"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-800">Active Operations</p><h2 className="text-lg font-semibold">งานที่กำลังดำเนินการ</h2></div><span className="text-sm font-semibold text-slate-500">{currentCases.length} งาน</span></div>{currentCases.map((item) => <AirportTransferCaseCard key={item.id} item={item} snapshot={snapshots[item.id]} tasks={tasks[item.id]} projectCode={projectCode} />)}</section> : null}
        {completedCases.length ? <section className="grid gap-2"><div className="flex items-end justify-between border-t border-slate-200 pt-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Completed</p><h2 className="text-lg font-semibold">งานที่เสร็จสิ้น</h2></div><span className="text-sm font-semibold text-slate-500">{completedCases.length} งาน</span></div>{completedCases.map((item) => <AirportTransferCaseCard key={item.id} item={item} snapshot={snapshots[item.id]} tasks={tasks[item.id]} projectCode={projectCode} />)}</section> : null}
        {cancelledCases.length ? <section className="grid gap-2"><div className="border-t border-slate-200 pt-4"><h2 className="text-lg font-semibold text-slate-600">งานที่ยกเลิก</h2></div>{cancelledCases.map((item) => <AirportTransferCaseCard key={item.id} item={item} snapshot={snapshots[item.id]} tasks={tasks[item.id]} projectCode={projectCode} />)}</section> : null}
      </> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-sm text-slate-500">ไม่พบข้อมูลตามเงื่อนไข</div>}
    </>
  );
}
