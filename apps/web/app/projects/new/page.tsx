import { PageHeader } from "@/components/page-header";
import { CreateProjectForm } from "@/components/projects/create-project-form";

export default function NewProjectPage() {
  return (
    <>
      <PageHeader
        eyebrow="Planning"
        title="New Project"
        description="Create the project container. This Sprint 1 form is isolated from live database writes."
      />
      <CreateProjectForm />
    </>
  );
}
