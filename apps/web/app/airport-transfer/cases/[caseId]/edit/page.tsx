import { notFound } from "next/navigation";
import { EditAirportTransferCaseForm } from "@/components/airport-transfer/edit-case-form";
import { getAirportTransferCase } from "@/lib/airport-transfer/data";

export default async function EditAirportTransferCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const item = await getAirportTransferCase(caseId);
  if (!item) notFound();
  return (
    <>
      <header><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">{item.caseCode}</p><h1 className="mt-1 text-2xl font-semibold">แก้ไขข้อมูลการเดินทาง</h1><p className="mt-2 text-sm text-slate-500">ทุกการเปลี่ยนแปลงจะบันทึกผู้แก้ไข เวลา ค่าเดิม และค่าใหม่</p></header>
      <EditAirportTransferCaseForm item={item} />
    </>
  );
}
