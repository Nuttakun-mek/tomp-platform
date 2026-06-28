import { AssignmentBoardPlaceholder } from "@/components/assignments/assignment-board-placeholder";
import { CreateAssignmentForm } from "@/components/assignments/create-assignment-form";
import { DriverAccessQrPlaceholder } from "@/components/driver/driver-access-qr-placeholder";
import { PageHeader } from "@/components/page-header";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";

interface AssignmentsPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function AssignmentsPage({ params }: AssignmentsPageProps) {
  const { projectId } = await params;
  const assignments = await getAssignmentsByProjectId(projectId);

  return (
    <>
      <PageHeader
        eyebrow="Assignment Kernel"
        title="Assignments"
        description={`Planning foundation for project ${projectId}. No live database writes are performed from this page.`}
      />
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
