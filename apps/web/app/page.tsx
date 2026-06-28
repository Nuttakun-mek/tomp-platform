const stages = ["Plan", "Prepare", "Operate", "Adapt", "Improve"];

const principles = [
  "Published plan is the baseline",
  "Change events after publish",
  "Timeline and audit are mandatory",
  "Google Maps handles navigation",
  "GPS supports visibility, not control",
  "QR access for temporary drivers"
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-ink">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-between px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-signal">TOMP</p>
            <h1 className="text-3xl font-semibold sm:text-4xl">Transportation Operations Management Platform</h1>
          </div>
          <div className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            PWA-first modular monolith
          </div>
        </header>

        <div className="grid gap-8 py-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="max-w-3xl text-lg leading-8 text-slate-700">
              Plan, coordinate, execute, monitor, and improve event-based transportation operations from one operational baseline.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {stages.map((stage) => (
                <div key={stage} className="rounded-md border border-slate-200 bg-white p-4 text-center text-sm font-semibold shadow-sm">
                  {stage}
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">Operating Boundary</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              TOMP is not fleet management, ERP, or CRM. It manages transportation operations around projects, missions, assignments, call signs, timelines, and audit.
            </p>
          </aside>
        </div>

        <section className="grid gap-3 pb-6 sm:grid-cols-2 lg:grid-cols-3">
          {principles.map((principle) => (
            <div key={principle} className="rounded-md border border-slate-200 bg-white p-4 text-sm font-medium text-slate-800 shadow-sm">
              {principle}
            </div>
          ))}
        </section>
      </section>
    </main>
  );
}
