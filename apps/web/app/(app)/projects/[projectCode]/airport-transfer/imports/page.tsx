import { notFound } from "next/navigation";
import { FileSpreadsheet, ShieldCheck, Upload } from "lucide-react";
import { getProjectByCode } from "@/lib/data/projects";

export default async function AirportTransferImportsPage({ params }: { params: Promise<{ projectCode: string }> }) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();
  return (
    <>
      <header><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">Import Center</p><h1 className="mt-1 text-2xl font-semibold">นำเข้าข้อมูล Excel</h1><p className="mt-2 text-sm text-slate-500">พื้นที่พักข้อมูลก่อนตรวจรูปแบบ ตรวจเที่ยวบิน ตรวจข้อมูลซ้ำ และยืนยันเข้าฐานข้อมูลจริง</p></header>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-2xl border border-dashed border-cyan-300 bg-cyan-50/40 p-8 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-cyan-800 shadow-sm"><Upload className="h-6 w-6" /></span><h2 className="mt-4 text-lg font-semibold">Excel Import Pipeline พร้อมฐานข้อมูลแล้ว</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">ตัวอ่านไฟล์และหน้าจอจับคู่คอลัมน์จะเพิ่มในลำดับถัดไป ข้อมูลจะไม่เข้าตารางหลักจนกว่าผู้ใช้ยืนยันผลตรวจ</p><button disabled className="mt-5 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500">เลือกไฟล์ .xlsx — ยังไม่เปิดใช้งาน</button></div>
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-cyan-800" /><h2 className="font-semibold">ลำดับการตรวจ</h2></div><ol className="mt-4 grid gap-3 text-sm text-slate-600">{["ตรวจหัวตารางและรูปแบบข้อมูล", "แปลงวันที่ เวลา และหมายเลขเที่ยวบิน", "ตรวจเที่ยวบินกับ API", "ตรวจข้อมูลซ้ำ รถและคนขับชนกัน", "แสดงแถวเขียว เหลือง แดง", "ยืนยันนำเข้าฐานข้อมูลจริง"].map((item, index) => <li key={item} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold">{index + 1}</span>{item}</li>)}</ol><div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500"><FileSpreadsheet className="h-4 w-4" />รองรับ Template เดิมของบริษัทในขั้นถัดไป</div></aside>
      </section>
    </>
  );
}

