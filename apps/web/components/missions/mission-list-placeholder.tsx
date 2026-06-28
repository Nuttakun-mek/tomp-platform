const missions = [
  {
    code: "MIS-001",
    name: "Airport pickup wave 1",
    type: "Airport Pickup",
    status: "Draft"
  }
];

export function MissionListPlaceholder() {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-lg font-semibold text-ink">Mission List</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Placeholder mission section inside the project detail foundation.</p>
      </div>
      <div className="divide-y divide-slate-200">
        {missions.map((mission) => (
          <div key={mission.code} className="grid gap-2 p-5 md:grid-cols-[1fr_auto]">
            <div>
              <p className="text-sm font-semibold text-operation">{mission.code}</p>
              <h3 className="mt-1 text-base font-semibold text-ink">{mission.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{mission.type}</p>
            </div>
            <span className="h-fit rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700">{mission.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
