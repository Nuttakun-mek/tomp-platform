import type { Project } from "@tomp/types/domain";

// Which project, nothing more. It was a ~300px hero, then a row with two live
// counts; the fleet board's chips carry those counts and filter by them.
export function CommandCenterHeader({ project }: { project: Project }) {
  return (
    <section className="rounded-panel bg-slate-950 px-4 py-2.5 text-white shadow-command">
      <p className="text-[11px] font-bold tracking-[0.2em] text-teal-200">ศูนย์ควบคุมปฏิบัติการ · {project.projectCode}</p>
      <h1 className="truncate text-lg font-semibold leading-snug">{project.projectName}</h1>
    </section>
  );
}
