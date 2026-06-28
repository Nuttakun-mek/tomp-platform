import { PageHeader } from "@/components/page-header";
import { CreateProjectForm } from "@/components/projects/create-project-form";
import { ProjectList } from "@/components/projects/project-list";

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Planning"
        title="Projects"
        description="Project is the main container for operational data. Sprint 1 establishes the UI foundation without database reads or writes."
      />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <CreateProjectForm />
        <ProjectList />
      </div>
    </>
  );
}
