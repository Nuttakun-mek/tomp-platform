import { AssignmentBoardPlaceholder } from "@/components/assignments/assignment-board-placeholder";
import { CreateAssignmentForm } from "@/components/assignments/create-assignment-form";
import { PageHeader } from "@/components/page-header";

interface AssignmentsPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function AssignmentsPage({ params }: AssignmentsPageProps) {
  const { projectId } = await params;

  return (
    <>
      <PageHeader
        eyebrow="Assignment Kernel"
        title="Assignments"
        description={`Planning foundation for project ${projectId}. No live database writes are performed from this page.`}
      />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <CreateAssignmentForm />
        <AssignmentBoardPlaceholder />
      </div>
    </>
  );
}
