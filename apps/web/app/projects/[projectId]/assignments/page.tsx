import { AssignmentBoardPlaceholder } from "@/components/assignments/assignment-board-placeholder";
import { CreateAssignmentForm } from "@/components/assignments/create-assignment-form";
import { DriverAccessQrPlaceholder } from "@/components/driver/driver-access-qr-placeholder";
import { PageHeader } from "@/components/page-header";
import { PublishedLockBanner } from "@/components/publish/published-lock-banner";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getProjectById } from "@/lib/data/projects";

interface AssignmentsPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function AssignmentsPage({ params }: AssignmentsPageProps) {
  const { projectId } = await params;
  const [project, assignments] = await Promise.all([getProjectById(projectId), getAssignmentsByProjectId(projectId)]);

  return (
    <>
      <PageHeader
        eyebrow="จัดสรรงาน"
        title="Assignment"
        description={`จัดสรรภารกิจ Call Sign คนขับ รถ และช่วงเวลาปฏิบัติงานสำหรับ ${project?.projectCode ?? projectId}`}
      />
      <PublishedLockBanner project={project} />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <CreateAssignmentForm projectId={projectId} />
        <div className="grid gap-6">
          <AssignmentBoardPlaceholder assignments={assignments} />
          <DriverAccessQrPlaceholder accessUrl={`/driver/demo-token?project=${projectId}`} />
        </div>
      </div>
    </>
  );
}
