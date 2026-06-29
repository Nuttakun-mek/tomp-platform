import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { PageSection } from "@/components/ui/page-section";

const operatingCycle = ["Plan", "Prepare", "Publish", "Operate", "Recover", "Review"];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Operations Dashboard"
        title="Dashboard"
        description="Internal pilot workspace for planning, readiness, assignment control, driver coordination, and operational timeline review."
      />
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Pilot stage" value="Internal" detail="Core workflow ready for guided testing" />
        <StatCard label="Operating cycle" value="6" detail="Plan through Review" />
        <StatCard label="Timeline policy" value="Immutable" detail="No edit/delete UI for events" />
      </section>
      <div className="mt-8">
        <PageSection title="Operating Cycle" description="TOMP keeps each event transport project moving through a controlled operations loop.">
          <section className="grid gap-4 md:grid-cols-3">
            {operatingCycle.map((stage) => (
              <div key={stage} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-operation">{stage}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">Use this stage to keep project teams aligned around readiness, baseline, live decisions, and operational memory.</p>
              </div>
            ))}
          </section>
        </PageSection>
      </div>
    </>
  );
}
