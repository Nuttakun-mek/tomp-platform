import { IncidentForm } from "@/components/recovery/incident-form";
import { RecoveryCommandPanel } from "@/components/recovery/recovery-command-panel";
import { PageHeader } from "@/components/page-header";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getProjects } from "@/lib/data/projects";
import { demoKernel } from "@/lib/demo/demo-kernel";

export default async function RecoveryPage() {
  const projects = await getProjects();
  const activeProjects = projects.length ? projects : demoKernel.projects;
  const assignmentsByProject = await Promise.all(activeProjects.map((project) => getAssignmentsByProjectId(project.id)));
  const assignments = assignmentsByProject.flat();

  return (
    <>
      <PageHeader
        eyebrow="ศูนย์ควบคุม"
        title="กู้คืนสถานการณ์"
        description="บันทึกเหตุผิดปกติ ประเมินความเสี่ยง และสร้างคำแนะนำการกู้คืนสำหรับงานขนส่ง โดยทุกเหตุการณ์ต้องอยู่ใน Timeline"
      />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <IncidentForm projects={activeProjects} assignments={assignments.length ? assignments : demoKernel.assignments} />
        <RecoveryCommandPanel />
      </div>
    </>
  );
}
