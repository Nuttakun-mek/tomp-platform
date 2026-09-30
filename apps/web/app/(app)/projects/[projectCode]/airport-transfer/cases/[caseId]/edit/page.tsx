import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { EditAirportTransferCaseForm } from "@/components/airport-transfer/edit-case-form";
import { getAirportTransferCase } from "@/lib/airport-transfer/data";
import { getProjectByCode } from "@/lib/data/projects";

export default async function EditAirportTransferCasePage({ params }: { params: Promise<{ projectCode: string; caseId: string }> }) {
  const { projectCode, caseId } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();
  const item = await getAirportTransferCase(caseId, project.id);
  if (!item) notFound();
  return (
    <>
      <PageHeader eyebrow={item.caseCode} title="แก้ไขข้อมูลการเดินทาง" description="ทุกการแก้ไขบันทึกไว้ในประวัติ" />
      <EditAirportTransferCaseForm item={item} projectCode={projectCode} />
    </>
  );
}
