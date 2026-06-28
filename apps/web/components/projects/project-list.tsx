import Link from "next/link";

const projectPlaceholders = [
  {
    id: "demo-project",
    code: "TOMP-2026-001",
    name: "Global Summit Transport",
    status: "Draft",
    dates: "2026-08-12 to 2026-08-14"
  }
];

export function ProjectList() {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-lg font-semibold text-ink">Project List</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Placeholder data until Supabase data access is introduced.</p>
      </div>
      <div className="divide-y divide-slate-200">
        {projectPlaceholders.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`} className="grid gap-2 p-5 hover:bg-slate-50 md:grid-cols-[1fr_auto]">
            <div>
              <p className="text-sm font-semibold text-operation">{project.code}</p>
              <h3 className="mt-1 text-base font-semibold text-ink">{project.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{project.dates}</p>
            </div>
            <span className="h-fit rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700">{project.status}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
