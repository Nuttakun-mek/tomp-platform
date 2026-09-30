import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { CreateAirportTransferCaseForm } from "@/components/airport-transfer/create-case-form";
import { getProjectByCode } from "@/lib/data/projects";

export default async function NewAirportTransferCasePage({ params }: { params: Promise<{ projectCode: string }> }) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();
  return (
    <>
      <PageHeader eyebrow="Airport Transfer" title="สร้างการ์ดข้อมูลการเดินทาง" description="ระบบสร้างเช็กลิสต์ให้ตามประเภทบริการ" />
      <CreateAirportTransferCaseForm projectId={project.id} />
    </>
  );
}
