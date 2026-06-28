import { PageHeader } from "@/components/page-header";

const operatingCycle = ["Plan", "Prepare", "Publish", "Operate", "Recover", "Review"];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Sprint 0"
        title="Dashboard"
        description="Foundation shell for the TOMP operations workspace. Operational data is intentionally not connected yet."
      />
      <section className="grid gap-4 md:grid-cols-3">
        {operatingCycle.map((stage) => (
          <div key={stage} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-operation">{stage}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Placeholder workspace area for Sprint 1 and later.</p>
          </div>
        ))}
      </section>
    </>
  );
}
