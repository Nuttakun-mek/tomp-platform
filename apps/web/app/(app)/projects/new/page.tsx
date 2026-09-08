import { PageHeader } from "@/components/page-header";
import { CreateProjectForm } from "@/components/projects/create-project-form";

export default function NewProjectPage() {
  return (
    <>
      <PageHeader
        eyebrow="การวางแผน"
        title="สร้างโครงการ"
        description="สร้างพื้นที่หลักสำหรับจัดการภารกิจ ทรัพยากร และแผนปฏิบัติการ"
      />
      <CreateProjectForm />
    </>
  );
}
